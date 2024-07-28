const { configs, usersByAlias, usersByMail } = require("../modules/configs.js");
const { mailgun, crypto, fs } = require("../modules/deps.js");
const { logger } = require("../modules/logging.js");
const {
	encryptMessageId,
	decryptMessageId,
	wrap,
	unwrap,
	parseAddress,
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
	attachments,
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

	if (attachments && !Array.isArray(attachments)) {
		throw Error("Attachments arg is not an array!");
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

	if (attachments.length > 0) {
		fields.attachment = attachments;
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
	const parsedAddresses = {};
	const proxiedAddresses = {};
	const attachments = [];

	const originalInReplyTo = req.body["In-Reply-To"] || "";
	const originalMessageId = req.body["Message-Id"] || "";
	const originalReplyTo = req.body["Reply-To"] || "";
	const originalSender = req.body.Sender || req.body.sender; // Header shenanigans
	const originalFromHeader = req.body.from || req.body.From; // Pt 2
	const subject = req.body.subject || req.body.Subject || ""; // Pt 3

	let inReplyTo = "";
	let messageId = "";
	const replyTo = (await parseAddress(originalReplyTo)).email || "";
	const sender = (await parseAddress(originalSender)).email;
	const senderFromName =
		(await parseAddress(originalFromHeader)).name || configs.defaultName;

	if (req.files && req.files.length > 0) {
		for (let i = 0; i < req.files.length; i++) {
			if (configs.noDisk) {
				attachments.push({
					filename: req.files[i].originalname,
					data: req.files[i].buffer,
				});
			} else {
				attachments.push({
					filename: req.files[i].originalname,
					data: await fs.promises.readFile(req.files[i].path),
				});
			}
		}
	}

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
			wrappedSender = await wrap(sender, recipientName); // Hard fail if we can't wrap
			newReplyTo = "";

			if (!wrappedSender) {
				res.status(406).end("Failed wrapping sender");
				return;
			}

			if (replyTo) {
				newReplyTo = (await wrap(replyTo, recipientName)) || ""; // Soft fail if we can't wrap
			}

			newSenderFromHeader = `${senderFromName} <${wrappedSender}>`;

			if (newSenderFromHeader in parsedAddresses) {
				parsedAddresses[newSenderFromHeader][0].push(
					usersByAlias[recipientName],
				);
			} else {
				parsedAddresses[newSenderFromHeader] = [
					[usersByAlias[recipientName]],
					newReplyTo,
				];
			}

			continue;
		}

		// When we reached here, it's likely a wrapped address
		// Check if we know the user
		if (!(sender in usersByMail)) {
			continue;
		}

		// Try unwrapping it
		unwrappedAddress = await unwrap(recipient);
		if (!unwrappedAddress) {
			// Failed to unwrap it as it's not a valid address
			continue;
		}

		// Push if alias is defined and user owns the alias
		if (
			unwrappedAddress.alias in usersByAlias &&
			usersByAlias[unwrappedAddress.alias] === sender
		) {
			newReplyTo = "";

			if (replyTo) {
				newReplyTo = (await wrap(replyTo, unwrappedAddress.alias)) || ""; // Soft fail if we can't wrap
			}

			if (unwrappedAddress.alias in proxiedAddresses) {
				proxiedAddresses[unwrappedAddress.alias][0].push(
					unwrappedAddress.destAddress,
				);
			} else {
				proxiedAddresses[unwrappedAddress.alias] = [
					[unwrappedAddress.destAddress],
					newReplyTo,
				];
			}
		}

		// If we reached here, we don't have a valid to address and can't send the email.
	}

	// Encrypt the message id

	messageId = await encryptMessageId(originalMessageId, sender);

	if (!messageId) {
		// Failed to encrypt, unrecoverable from here on.

		res.status(406).end("Failed encoding message id");
		return;
	}

	// Decrypt in reply to header if found. Send error if failed to decrypt

	if (originalInReplyTo) {
		inReplyTo = await decryptMessageId(originalInReplyTo, sender);
		if (!inReplyTo) {
			res.status(406).end("Failed decoding message id");
			return;
		}
	}

	// Tell mailgun we are sending the mail
	// Mailgun times out really quickly

	res.status(200).end("ok");

	if (Object.keys(parsedAddresses).length > 0) {
		for (senderFromHeader in parsedAddresses) {
			newReplyTo = parsedAddresses[senderFromHeader][1];
			sendMail(
				senderFromHeader,
				parsedAddresses[senderFromHeader][0],
				subject,
				bodyPlain,
				bodyHtml,
				messageId,
				inReplyTo,
				newReplyTo,
				attachments,
			);
		}
	}

	if (Object.keys(proxiedAddresses).length > 0) {
		for (alias in proxiedAddresses) {
			dest = proxiedAddresses[alias][0];
			newReplyTo = proxiedAddresses[alias][1];

			fromName =
				alias ||
				(await parseAddress(originalFromHeader)).name ||
				configs.defaultName;
			newFromHeader = `${fromName} <${alias}@${configs.mailerDomain}>`;

			sendMail(
				newFromHeader,
				dest,
				subject,
				bodyPlain,
				bodyHtml,
				messageId,
				inReplyTo,
				newReplyTo,
				attachments,
			);
		}
	}
}

module.exports = { sendMail, webhookHandler, webhookValidator };
