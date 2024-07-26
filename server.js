const { logger } = require("./modules/logging.js");
const { configs } = require("./modules/configs.js");

const { attachments, express, bodyParser } = require("./modules/deps.js");
const { cleanUpAttachmentsMiddleware } = require("./modules/utils.js");

const { webhookValidator, webhookHandler } = require(
	`./handlers/${configs.integration}.js`,
);

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.post(
	configs.receiveEndpoint,
	attachments.any(),
	cleanUpAttachmentsMiddleware,
	webhookValidator,
	webhookHandler,
);

// Sinkholes all other requests

app.all("*", async (req, res) => {
	res.status(404).end();
});

// Start server
logger.info("Starting webhook");

app.listen(3000);
