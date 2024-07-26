// Builtins
const fs = require("node:fs");
const crypto = require("node:crypto");

// Dotenv
const { config: loadEnvFileIntoProcessEnv } = require("dotenv");

// Winston
const winston = require("winston");

// Mailgun
const formData = require("form-data");
const Mailgun = require("mailgun.js");
const mailgun = new Mailgun(formData);

// Express, multer and body-parser
const express = require("express");
const multer = require("multer");
const bodyParser = require("body-parser");
const attachments = multer({
	dest: "tmp/",
	limits: {
		fieldSize: 5 * 1024 * 1024, // 5 MB
		fileSize: 25 * 1024 * 1024, // 25 MB, any larger and it might as well be a dos attack
		files: 10,
	},
});

module.exports = {
	fs,
	crypto,
	loadEnvFileIntoProcessEnv,
	winston,
	bodyParser,
	mailgun,
	express,
	attachments,
};
