In this scenario, Mr Wolf (`wolf@forrest.com`) wants to send an email to
Vincent, the fox, asking to meet up.

Vincent wants to hide his name as well as to proxy all emails to and from
`fox.den`, so he used the alias `fox` and configured it to forward the mail to
`vincent-foxtail@fox.mail`

Here are what the smtp headers sent to the proxy server should look like.

```
From: Mr Wolf <wolf@forrest.com>
To: fox@fox.den
Message-Id: <1234.0001@forrest.com>
```

The proxy server will then modify the following headers to this.

```
From: Mr Wolf <wolf_at_forrest.com_fox@fox.den>
To: vincent-foxtail@fox.mail
Message-Id: <Encrypted Message-Id 1>@fox.den
```

The `From` header's address is transformed from `wolf@forrest.com` to
`wolf_at_forrest.com_fox@fox.den` which follows the format
`<Escaped address>_<Alias>@<Domain>`

Next, the proxy server does a lookup on the alias and replaces the `To` header
with Vincent's real address

Finally, the `Message-Id` header is encrypted using authenticated encryption.
The encryption is used to hide the original domain and to prevent reply
hijacking, which is when a third party takes the message id and replies to the
email pretending to be the receiver.

Having the encryption be authenticated also allows the server to verify that the
encrypted message id is not modified. The verification happens later on.

Vincent replies to the email to agree to the meeting and to set the location and
time of meeting.

```
From: Vincent Foxtail <vincent-foxtail@fox.mail>
To: wolf_at_forrest_fox@fox.den
Message-Id: <4321.0002@fox.mail>
In-Reply-To: <Encrypted Message-Id 1>@fox.den
```

Upon receiving the above, the proxy server does the same thing, except that now,
the server verifies and decrypts the `In-Reply-To` header and replaces the
sender name

```
From: fox <fox@fox.den>
To: wolf@forrest.com
Message-Id: <Encrypted Message-Id 2>@fox.den
In-Reply-To: <1234.0001@forrest.com>
```
