const {
	fs,
	loadEnvFileIntoProcessEnv,
	crypto,
	hexDecode,
} = require("./deps.js");
const { logger } = require("./logging.js");

process.env.NODE_ENV = "production";

if (fs.existsSync(".env")) {
	logger.warn(
		"Loading variables from .env. This is dangerous, variables should be set in environment variables instead of .env",
	);

	loadEnvFileIntoProcessEnv();
}

if (!fs.existsSync("users.json")) {
	logger.error("File users.json is missing, exiting!");
	logger.info("Check out user.json.sample for reference.");

	throw Error("File users.json is missing!");
}

const usersByAlias = require("../users.json");
const usersByMail = {};

if (Object.keys(usersByAlias).length === 0) {
	logger.error("File users.json is empty, exiting!");
	logger.info("Check out user.json.sample for reference.");

	throw Error("File users.json is empty!");
}

for (const userAlias in usersByAlias) {
	const userMail = usersByAlias[userAlias];

	if (userMail in usersByMail) {
		usersByMail[userMail].add(userAlias);
		continue;
	}

	usersByMail[userMail] = new Set([userAlias]);
}

logger.info(`Loaded ${Object.keys(usersByAlias).length} aliases`);

const configs = {
	integration: process.env.INTEGRATION || "mailgun",
	receiveEndpoint: process.env.RECEIVE_ENDPOINT || "/api/receive-mail",

	// For serverless infrastructure where disk writes are generally not allowed.
	noDisk: Boolean(process.env.NO_DISK) || false,

	// Putting the key in the env is a bad idea, however serverless infrastructure does not allow for disk writes.
	// Key format is 64 character long hex encoded.
	decryptKey: process.env.DECRYPT_KEY || "",

	// For when the From header is missing the name. Not likely to happen so who knows.
	defaultName: process.env.DEFAULT_NAME || "No Name",
	mailerDomain: process.env.MAILER_DOMAIN || "",

	// Here comes the mailgun options
	mailgunApiKey: process.env.MAILGUN_API_KEY || "",
	mailgunWebhookSigningKey: process.env.MAILGUN_WEBHOOK_SIGNING_KEY || "",
	mailgunApiEndpoint:
		process.env.MAILGUN_API_ENDPOINT || "https://api.mailgun.net",
};

if (!configs.mailerDomain) {
	throw Error("Mailer domain needs to be set!");
}

if (configs.decryptKey) {
	logger.warn(
		"Setting your decryption key in the environment variables is a BAD IDEA. Use it ONLY IF you don't have disk write permission",
	);

	configs.decryptKey = hexDecode(configs.decryptKey);
} else {
	if (fs.existsSync("key")) {
		configs.decryptKey = hexDecode(fs.readFileSync("key", "utf-8"), "hex");
	} else {
		configs.decryptKey = crypto.randomBytes(64);
		fs.writeFileSync("key", configs.decryptKey.toString("hex"));
	}
}

if (!configs.decryptKey) {
	throw Error("Failed to decode decryptKey!");
}

module.exports = { configs, usersByAlias, usersByMail };
