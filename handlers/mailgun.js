const { configs, usersByAlias, usersByMail } = require("../modules/configs.js");
const { mailgun, crypto } = require("../modules/deps.js");
const { logger } = require("../modules/logging.js");
const {
	parseFromField,
	generateMessageId,
	wrap,
	unwrap,
	unwrapForwardAddress,
} = require("../modules/utils.js");

const mg = mailgun.client({
	username: "api",
	key: configs.mailgunApiKey,
	url: configs.mailgunApiEndpoint,
});

async function sendMail(
	sender,
	to,
	subject,
	text,
	html,
	messageId,
	inReplyTo,
	replyTo,
) {
	if (!sender) {
		throw Error("Sender arg is missing!");
	}

	if (!to) {
		throw Error("To arg is missing!");
	}

	if (!Array.isArray(to)) {
		throw Error("To arg is not an array!");
	}

	if (!subject) {
		throw Error("Subject arg is missing!");
	}

	if (!text && !html) {
		throw Error("Text and html args are missing!");
	}

	if (!messageId) {
		throw Error("Message ID is missing!");
	}

	const fields = {
		from: sender,
		to: to,
		subject: subject,
		"h:Message-Id": messageId,
	};

	if (text) {
		fields.text = text;
	}

	if (html) {
		fields.html = html;
	}

	if (inReplyTo) {
		fields["h:In-Reply-To"] = inReplyTo;
	}

	if (replyTo) {
		fields["h:Reply-To"] = replyTo;
	}

	await mg.messages
		.create(configs.mailerDomain, fields)
		.then(() => logger.info("Sent email successfully!"))
		.catch((err) => logger.error(`Failed to send email: ${err}`));
}

async function webhookValidator(req, res, next) {
	if (!req.body) {
		res.status(404).end("");
		return;
	}

	const token = req.body.token;
	const timestamp = req.body.timestamp;
	const signature = req.body.signature;

	if (!timestamp || !signature || !token) {
		res.status(404).end("");
		return;
	}

	const encodedToken = crypto
		.createHmac("sha256", configs.mailgunWebhookSigningKey)
		.update(timestamp + token)
		.digest("hex");

	if (encodedToken === signature) {
		await next();
		return;
	}

	res.status(404).end();
}

async function webhookHandler(req, res) {
	const bodyPlain = req.body["body-plain"] || "";
	const bodyHtml = req.body["body-html"] || "";

	const recipients = req.body.recipient.split(",");
	const parsedAddresses = [];
	const proxiedAddresses = [];

	const originalInReplyTo = req.body["In-Reply-To"] || "";
	const originalMessageId = req.body["Message-Id"] || "";
	let messageId = "";
	let inReplyTo = "";

	const sender = req.body.Sender || req.body.sender; // Header shenanigans
	const originalFromHeader = req.body.from || req.body.From; // Pt 2
	const subject = req.body.subject || req.body.Subject || "";

	// Parse addresses
	for (let i = 0; i < recipients.length; i++) {
		recipient = recipients[i];
		atIndex = recipient.lastIndexOf("@");
		recipientName = recipient.slice(0, atIndex);
		recipientDomain = recipient.slice(atIndex + 1);

		if (recipientDomain !== configs.mailerDomain) {
			// Address is not from our domain, drop.
			continue;
		}

		// Check if it is in the alias, if so, lookup the email and put it in.
		if (recipientName in usersByAlias) {
			parsedAddresses.push(usersByAlias[recipientName]);
			continue;
		}

		// Try unwrapping it as a normal address
		unwrappedAddress = await unwrap(recipient);
		if (unwrappedAddress) {
			parsedAddresses.push(unwrappedAddress.destAddress);
		}

		// Check if forward proxying is enabled.
		if (!configs.allowOutboundMail) {
			continue;
		}

		// Check if we know the user
		if (!(sender in usersByMail)) {
			continue;
		}

		// Try unwrapping it as a forward address
		unwrappedAddress = await unwrapForwardAddress(recipient);
		if (!unwrappedAddress) {
			// Failed to unwrap it as it's not a valid address
			continue;
		}

		// Push if alias is defined and user owns the alias
		if (
			unwrappedAddress.alias in usersByAlias &&
			usersByAlias[unwrappedAddress.alias] === sender
		) {
			proxiedAddresses.push([
				unwrappedAddress.alias,
				unwrappedAddress.destAddress,
			]);
		}

		// If we reached here, we don't have a valid to address and can't send the email.
	}

	// inReplyTo message id rewrite if it is the first email sent to proxy.
	// else we reuse message id
	if (originalInReplyTo) {
		messageId = await generateMessageId();
		inReplyTo = originalInReplyTo;
	} else {
		messageId = originalMessageId;
	}

	// Tell mailgun we are sending the mail
	// Mailgun times out really quickly

	res.status(200).end("ok");

	if (parsedAddresses.length > 0) {
		fromName =
			(await parseFromField(originalFromHeader)) || configs.defaultName;
		newFromHeader = `${fromName} <${(await wrap(sender)) || sender}>`;

		sendMail(
			newFromHeader,
			parsedAddresses,
			subject,
			bodyPlain,
			bodyHtml,
			messageId,
			inReplyTo,
		);
	}

	if (proxiedAddresses.length > 0) {
		for (let i = 0; i < proxiedAddresses.length; i++) {
			[alias, dest] = proxiedAddresses[i];

			fromName =
				alias ||
				(await parseFromField(originalFromHeader)) ||
				configs.defaultName;
			newFromHeader = `${fromName} <${alias}@${configs.mailerDomain}>`;

			sendMail(
				newFromHeader,
				[dest],
				subject,
				bodyPlain,
				bodyHtml,
				messageId,
				inReplyTo,
			);
		}
	}
}

module.exports = { sendMail, webhookHandler, webhookValidator };
