In this scenario, Vincent wants to send a email to Mr Wolf (`wolf@forrest.com`)

Vincent has configured the proxy to proxy mail to and from
`vincent-foxtail@fox.mail` as `fox@fox.den`.

The recipient address will have to wrapped in this format
`<Escaped address>_<Alias>@<Domain>` where the recipient address will have the
`@` replaced with `_at_`.

Here are what the smtp headers sent to the proxy server should look like.

```
From: Vincent Foxtail <vincent-foxtail@fox.mail>
To: wolf_at_forrest.com_fox@fox.den
Message-Id: <1234.0001@merch.com>
```

The proxy server will then modify the following headers to this.

```
From: fox <fox@fox.den>
To: wolf@forrest.com
Message-Id: <Encrypted Message-Id 1>@fox.den
```
