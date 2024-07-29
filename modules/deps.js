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

// Custom hexDecode function
const hexStringRegex = /^[0-9A-Fa-f]+$/;

function hexDecode(hexString) {
	if (!hexString || typeof hexString !== "string") {
		return false;
	}

	if (hexString.length % 2 !== 0) {
		return false;
	}

	if (hexStringRegex.test(hexString)) {
		return Buffer.from(hexString, "hex");
	}

	return false;
}

module.exports = {
	fs,
	crypto,
	loadEnvFileIntoProcessEnv,
	winston,
	bodyParser,
	mailgun,
	express,
	multer,
	hexDecode,
};
