# Fast Mail Proxy

_Or Fox Mail Proxy, depending on if you want to be cute :3._

## About

Fast Mail Proxy is a simple mail proxy that uses email apis to act as a
transparent proxy.

Mail can be sent as well as received through the proxy by using special
addresses

## Backstory

A while back, I was excited to use cloudflare's mail forwarding, however, when I
used it, I discovered that it can only forward mail and not act as a true proxy.
Sending mail through it and keeping anonymity while replying was impossible.

This was an issue for me as I wanted something privacy preserving like duck's
email proxy, where mail can be sent through the proxy and be sent out under a
vanity address.

This project is a implementation of what I hope that I could get from
cloudflare's email forwarding service, as well as the ability to semi self host
a email proxy service.

## Setting up

Fast Mail Proxy can accept any kind of mail, as long as the relevant handlers
are defined. The current default handler is mailgun.

### Non serverless environments

Edit users.json and you are good to go!

### Serverless environments

Users need to be set manually by pushing to kv storage.

`NO_DISK` as well as `DECRYPT_KEY` needs to be set as well.

To create and namespace, check out this piece of
[documentation by cloudflare](https://developers.cloudflare.com/kv/get-started/#2-create-a-kv-namespace)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Sh4yy/cloudflare-email)

## Options

### Server options

`INTEGRATION`: The handler to load, defaults to `mailgun`

`RECEIVE_ENDPOINT`: The webhook's listening endpoint, defaults to
`/api/receive-mail`

`NO_DISK`: Disable disk writes, defaults to false,

`DECRYPT_KEY`: Server's decryption key in hex format. Usually set if there isn't
disk write access.

`DEFAULT_NAME`: Sender's default name if the script fails to extract it.
Defaults to `No Name`

`MAILER_DOMAIN`: The domain in which mail is configured to be sent from. Must be
set.

### Mailgun options

Most keys can be found
[in this article by mailgun]("https://help.mailgun.com/hc/en-us/articles/203380100-Where-can-I-find-my-API-keys-and-SMTP-credentials")

`MAILGUN_API_KEY`: Mailgun's api key

`MAILGUN_WEBHOOK_SIGNING_KEY`: Mailgun webhook signing key, used for
verification.

`MAILGUN_API_ENDPOINT`: Mailgun's api endpoint, change if your account is in
europe. Default is https://api.mailgun.net

## How does it work?

The directory [how-it-works](/how-it-works) explains how the proxy functions.

### Receiving

To receive mail, configure `users.json` and set the alias for your email. There
is an example file in `users.json.sample`

All mail that gets sent to the address will be forwarded to the configured
email.

### Sending

The to address field will have to be modified accordingly (Check out function
`wrap` and `unwrap` for the exact process in `modules/utils.js`)

To manually wrap the address, here are the steps

1. Replace `@` with `_at_`
2. Add on your alias to the back prefixed with an underscore. For example, a
   user with alias `fox` will have to add on `_fox` to the back of the address
3. Add on your mailing domain

So, if you want to send a email as `fox@proxy.com`, where `fox` is the alias and
`proxy.com` is the mailer domain to `wolf@forrest.com`, the to address will look
like this

`wolf_at_forrest.com_fox@proxy.com`

(Using foxes and wolfs are more cute and interesting than the overused alice and
bob. Fight me if you don't like it.)

Sending mail requires a alias as the proxy needs to know who to address as well
as to check if the sender owns the alias.

## Future features

- [ ] Cloudflare workers support using cloudflare kv storage
- [x] Generic serverless support

*Serverless support might have some issues where large attachments will cause a
timeout.
