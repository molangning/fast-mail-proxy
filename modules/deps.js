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

module.exports = {
	fs,
	crypto,
	loadEnvFileIntoProcessEnv,
	winston,
	bodyParser,
	mailgun,
	express,
	multer,
};
