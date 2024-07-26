const { fs, loadEnvFileIntoProcessEnv } = require("./deps.js");
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
	defaultName: process.env.DEFAULT_NAME || "Unknown Sender", // For when the From header is missing the name. Not likely to happen so who knows.
	allowOutboundMail: Boolean(process.env.ALLOW_OUTBOUND_MAIL) || false, // Allows users in user.json to send mail through the proxy. Default is receive only.
	mailerDomain: process.env.MAILER_DOMAIN || "",
	mailgunApiKey: process.env.MAILGUN_API_KEY || "",
	mailgunWebhookSigningKey: process.env.MAILGUN_WEBHOOK_SIGNING_KEY || "",
	mailgunApiEndpoint:
		process.env.MAILGUN_API_ENDPOINT || "https://api.mailgun.net",
};

if (!configs.mailerDomain) {
	throw Error("Mailer domain needs to be set!");
}

module.exports = { configs, usersByAlias, usersByMail };
