const { logger } = require("./modules/logging.js");
const { configs } = require("./modules/configs.js");

const { express, multer, bodyParser } = require("./modules/deps.js");
const { cleanUpAttachmentsMiddleware } = require("./modules/utils.js");

const { webhookValidator, webhookHandler } = require(
	`./handlers/${configs.integration}.js`,
);

const multerOptions = {
	limits: {
		fieldSize: 5 * 1024 * 1024, // 5 MB
		fileSize: 25 * 1024 * 1024, // 25 MB, any larger and it might as well be a dos attack
		files: 10,
	},
};

if (configs.noDisk) {
	multerOptions.storage = multer.memoryStorage();
} else {
	multerOptions.dest = "tmp/";
}

const attachments = multer(multerOptions);

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

app.all("*", (req, res) => {
	res.status(404).end();
});

// Start server
logger.info("Starting webhook");

app.listen(3000);
