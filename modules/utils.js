const { configs, usersByAlias, usersByMail } = require("./configs.js");
const { fs, crypto } = require("./deps.js");

const emailRegex =
	/(?:[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;
const fromRegex = /((?:.*?) )<.+>/;

messageIdKeyNames = ["Message-ID", "Message-Id"];

// Wraps sender@mail.origin.com, alias, mail.proxy.com
// into sender_at_mail.origin.com_alias@mail.proxy.com

async function wrapForwardAddress(
	senderAddress,
	receiver,
	mailerDomain = configs.mailerDomain,
) {
	if (!emailRegex.test(senderAddress)) {
		return false;
	}

	[sender, senderDomain] = senderAddress.split("@", 2);

	if (senderDomain === configs.mailerDomain) {
		if (sender in usersByAlias) {
			return senderAddress;
		}
		return false;
	}

	const atIndex = senderAddress.lastIndexOf("@");
	const newSenderAddress = `${senderAddress.slice(0, atIndex)}_at_${senderAddress.slice(atIndex + 1)}`;

	return `${newSenderAddress}_${receiver}@${mailerDomain}`;
}

// Wraps sender@mail.origin.com, mail.proxy.com
// into sender_at_mail.origin.com@mail.proxy.com

async function wrap(senderAddress, mailerDomain = configs.mailerDomain) {
	if (!emailRegex.test(senderAddress)) {
		return false;
	}

	[sender, senderDomain] = senderAddress.split("@", 2);

	if (senderDomain === configs.mailerDomain) {
		if (sender in usersByAlias) {
			return senderAddress;
		}
		return false;
	}

	const atIndex = senderAddress.lastIndexOf("@");
	const newSenderAddress = `${senderAddress.slice(0, atIndex)}_at_${senderAddress.slice(atIndex + 1)}`;

	return `${newSenderAddress}@${mailerDomain}`;
}

// Unwraps email like sender_at_mail.origin.com@mail.proxy.com
// to sender@mail.origin.com, mail.proxy.com

async function unwrap(receiver) {
	if (!emailRegex.test(receiver)) {
		return false;
	}

	let mailerDomain = "";

	[destAddress, mailerDomain] = receiver.split("@", 2);

	if (mailerDomain !== configs.mailerDomain) {
		return false;
	}

	const lastIndex = destAddress.lastIndexOf("_at_");

	if (lastIndex === -1) {
		return false;
	}

	const sender = destAddress.slice(0, lastIndex);
	const senderDomain = destAddress.slice(lastIndex + 4);

	if (senderDomain.indexOf("_") !== -1) {
		return false;
	}

	if (senderDomain === configs.mailerDomain && !(sender in usersByAlias)) {
		return false;
	}

	destAddress = `${sender}@${senderDomain}`;

	return { destAddress, mailerDomain };
}

// Unwraps email like sender_at_mail.origin.com_alias@mail.proxy.com
// to sender@mail.origin.com, alias, mail.proxy.com
async function unwrapForwardAddress(senderAddress) {
	if (!emailRegex.test(senderAddress)) {
		return false;
	}

	let newSenderAddress = "";
	let mailerDomain = "";

	[newSenderAddress, mailerDomain] = senderAddress.split("@", 2);

	let lastIndex = newSenderAddress.lastIndexOf("_");
	if (lastIndex === -1) {
		return false;
	}

	let destAddress = newSenderAddress.slice(0, lastIndex);
	const alias = newSenderAddress.slice(lastIndex + 1);

	lastIndex = destAddress.lastIndexOf("_at_");

	if (lastIndex === -1) {
		return false;
	}

	const sender = destAddress.slice(0, lastIndex);
	const senderDomain = destAddress.slice(lastIndex + 4);

	if (senderDomain === configs.mailerDomain) {
		if (sender in usersByAlias) {
			return senderAddress;
		}
		return false;
	}

	destAddress = `${sender}@${senderDomain}`;

	return { destAddress, alias, mailerDomain };
}

async function parseFromField(fromField) {
	// Parses from field and returns name

	if (typeof fromField !== "string") {
		throw Error("fromField is not a string!");
	}

	const name = fromRegex.exec(fromField);

	if (!name) {
		return false;
	}

	trimmedName = name[1].trim();

	if (trimmedName) {
		return trimmedName;
	}

	return name[1];
}

async function encodeMessageId(messageId) {
	const newMessageId = Buffer.from(messageId).toString("base64url");
	return `<e.${newMessageId}@${configs.mailerDomain}>`;
}

async function decodeMessageId(messageId) {
	if (!messageId.startsWith("<e.") || !messageId.endsWith(">")) {
		return false;
	}

	const originalMessageId = Buffer.from(
		messageId.slice(3, messageId.lastIndexOf("@")),
		"base64url",
	).toString("utf-8");

	return originalMessageId;
}

async function generateMessageId() {
	const hashedId = crypto
		.createHash("sha256")
		.update(crypto.randomBytes(16))
		.digest("base64url");
	const timestamp = String(Math.floor(Date.now() / 1000));
	return `<h.${hashedId}.${timestamp}@${configs.mailerDomain}>`;
}

async function cleanUpAttachmentsMiddleware(req, res, next) {
	const files = req.files;
	const cleaner = () => {
		if (!files) {
			return;
		}

		for (let i = 0; i < files.length; i++) {
			const attachmentLocation = files[i].path;

			try {
				fs.rmSync(attachmentLocation);
			} catch {
				// File was removed, do nothing
			}
		}
	};

	res.once("finish", cleaner);
	res.once("error", cleaner);
	res.once("close", cleaner);

	await next();
}

module.exports = {
	wrap,
	wrapForwardAddress,
	unwrap,
	unwrapForwardAddress,
	parseFromField,
	cleanUpAttachmentsMiddleware,
	encodeMessageId,
	decodeMessageId,
	generateMessageId,
};
