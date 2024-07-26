const { winston } = require("./deps.js");

module.exports.logger = winston.createLogger({
	format: winston.format.combine(
		winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
		winston.format.colorize(),
		winston.format.printf(({ level, message, timestamp }) => {
			return `${timestamp} ${level}: ${message}`;
		}),
	),
	transports: [new winston.transports.Console()],
});
