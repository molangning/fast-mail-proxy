const { from } = require("form-data");
const { configs, usersByAlias, usersByMail } = require("./configs.js");
const { fs, crypto } = require("./deps.js");

const emailRegex =
	/^(?:[a-z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+\/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/;
const fromRegex = /^(.*?)<(.+)>$/;

messageIdKeyNames = ["Message-ID", "Message-Id"];

// Wraps sender@mail.origin.com, alias, mail.proxy.com
// into sender_at_mail.origin.com_alias@mail.proxy.com

async function wrap(
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

// Unwraps email like sender_at_mail.origin.com_alias@mail.proxy.com
// to sender@mail.origin.com, alias, mail.proxy.com
async function unwrap(senderAddress) {
	if (!emailRegex.test(senderAddress)) {
		return false;
	}

	let newSenderAddress = "";
	let mailerDomain = "";

	[newSenderAddress, mailerDomain] = senderAddress.split("@", 2);

	if (mailerDomain !== configs.mailerDomain) {
		return false;
	}

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

	return { alias, destAddress };
}

// Takes input like Vincent Foxtail <vincent-foxtail@fox.mail>
// And extracts the individual components
// Vincent Foxtail, vincent-foxtail@fox.mail
//
// If it does not follow the format, return if
// Valid email.

async function parseAddress(fromField) {
	// Parses from field and returns name

	const fields = {
		name: "",
		email: "",
	};

	if (typeof fromField !== "string") {
		return fields;
	}

	if (
		fromField.indexOf(">") === -1 &&
		fromField.indexOf("<") === -1 &&
		emailRegex.test(fromField)
	) {
		fields.email = fromField;
		return fields;
	}

	const extracted = fromRegex.exec(fromField);

	if (!extracted) {
		return fields;
	}

	fields.name = extracted[1].trim() || extracted[1];
	fields.email = extracted[2].trim();

	return fields;
}

// Packs the message id and sender into one string and encrypts it
//
// It is reasonably secure as only the server can decrypt it
// and if a replay attack occurs the sender has to match.
// Replay of the message id in In-Reply-To is possible if
// Sender replies to the same message more than once
// I might not be correct, this is how I understood it.
//
// We will use chacha20-poly1305 for this
async function encryptMessageId(messageId, sender) {
	if (typeof messageId !== "string" || typeof sender !== "string") {
		return false;
	}

	const hashedSender = crypto
		.createHash("md5")
		.update(sender)
		.digest("base64url");
	const plaintext = Buffer.from(`${messageId}:${hashedSender}`);

	const randomNonce = crypto.randomBytes(24);
	const derivedKey = crypto.hkdfSync(
		"sha512",
		configs.decryptKey,
		"",
		randomNonce,
		44,
	);
	const messageKey = derivedKey.slice(0, 32);
	const messageNonce = derivedKey.slice(32);

	const cipher = crypto.createCipheriv(
		"chacha20-poly1305",
		messageKey,
		messageNonce,
		{
			authTagLength: 16,
		},
	);

	cipher.setAAD(randomNonce);

	let ciphertext = cipher.update(plaintext, "utf8");
	ciphertext = Buffer.concat([ciphertext, cipher.final()]);

	const tag = cipher.getAuthTag();
	const packedCiphertext = Buffer.concat([
		tag,
		randomNonce,
		ciphertext,
	]).toString("base64url");

	return `<e.${packedCiphertext}@${configs.mailerDomain}>`;
}

async function decryptMessageId(messageId, sender) {
	if (typeof messageId !== "string" || typeof sender !== "string") {
		return false;
	}

	if (!messageId.startsWith("<") || !messageId.endsWith(">")) {
		return false;
	}

	const hashedSender = crypto
		.createHash("md5")
		.update(sender)
		.digest("base64url");
	const mailerDomain = messageId.slice(messageId.lastIndexOf("@") + 1, -1);

	if (mailerDomain !== configs.mailerDomain) {
		return False;
	}

	const packedCiphertext = Buffer.from(
		messageId.slice(3, messageId.lastIndexOf("@")),
		"base64url",
	);

	if (packedCiphertext.length <= 40) {
		return false;
	}

	const tag = packedCiphertext.subarray(0, 16);
	const randomNonce = packedCiphertext.subarray(16, 40);
	const ciphertext = packedCiphertext.subarray(40);

	const derivedKey = crypto.hkdfSync(
		"sha512",
		configs.decryptKey,
		"",
		randomNonce,
		44,
	);

	const messageKey = derivedKey.slice(0, 32);
	const messageNonce = derivedKey.slice(32);

	const decipher = crypto.createDecipheriv(
		"chacha20-poly1305",
		messageKey,
		messageNonce,
		{
			authTagLength: 16,
		},
	);

	decipher.setAuthTag(tag);
	decipher.setAAD(randomNonce);

	let plaintext = decipher.update(ciphertext);

	try {
		plaintext = Buffer.concat([plaintext, decipher.final()]).toString("utf-8");
	} catch {
		return false;
	}

	const lastIndex = plaintext.lastIndexOf(":");
	const decryptedMessageId = plaintext.slice(0, lastIndex);
	const decryptedHashedSender = plaintext.slice(lastIndex + 1);

	if (hashedSender !== decryptedHashedSender) {
		return false;
	}

	return decryptedMessageId;
}

async function cleanUpAttachmentsMiddleware(req, res, next) {
	const files = req.files;
	const cleaner = () => {
		if (!files) {
			return;
		}

		for (let i = 0; i < files.length; i++) {
			const attachmentLocation = files[i].path;

			if (!attachmentLocation) {
				continue;
			}

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
	unwrap,
	parseAddress,
	cleanUpAttachmentsMiddleware,
	encryptMessageId,
	decryptMessageId,
};
