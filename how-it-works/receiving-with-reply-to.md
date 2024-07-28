In this scenario, Vincent signed up for an account at a shop selling merchandise
that sends emails as `Merch Store <noreply@merch.com>` and has a reply address
for contact reason at `contact@merch.com`

Vincent has configured the proxy to proxy mail to and from
`vincent-foxtail@fox.mail` as `fox@fox.den`.

The merchandise shop sent a email to Vincent notifying him of a new flash sale.

Here are what the smtp headers sent to the proxy server should look like.

```
From: Merch Store <noreply@merch.com>
To: fox@fox.den
Message-Id: <1234.0001@merch.com>
Reply-To: contact@merch.com
```

The proxy server will then modify the following headers to this.

```
From: Merch Store <noreply_at_merch.com_fox@fox.den>
To: vincent-foxtail@fox.mail
Message-Id: <Encrypted Message-Id 1>@fox.den
Reply-To: contact_at_merch.com_fox@fox.den
```

The headers is transformed as how it would be normally, with the `Reply-To`
header transformed as well.

Vincent replies to the email to ask more about the sale.

```
From: Vincent Foxtail <vincent-foxtail@fox.mail>
To: contact_at_merch.com_fox@fox.den
Message-Id: <4321.0002@fox.mail>
In-Reply-To: <Encrypted Message-Id 1>@fox.den
```

The header gets transformed as how it would normally be.
