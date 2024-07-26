# Fast Mail Proxy

_Or Fox Mail Proxy, depending on if you want to be cute :3._

## About

Fast Mail Proxy is a simple mail proxy that uses email apis to act as a
transparent proxy.

Mail can be sent as well as received through the proxy by using special
addresses

## Receiving

To receive mail, configure `users.json` and set the alias for your email. There
is an example file in `users.json.sample`

All mail that gets sent to the address will be forwarded to the configured
email.

## Sending

To send mail, you need to set environment variable `ALLOW_OUTBOUND_MAIL` to
true.

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

Sending mail requires a alias as the proxy needs to know who to address.

## Caveats

Sending mail through the proxy will review your provider through message-id.
This is unavoidable until I can find a way to patch it.

This can be hidden by encrypting the message-id and decrypting it when it
reaches the proxy.

Replying to mail that was sent through the special address (like
`wolf_at_forrest.com_fox@proxy.com`) will result in leaking the display name

This could be solved using a special reply address or extracting the alias from
above

All other headers are dropped except for the essential headers like `Reply-To`
