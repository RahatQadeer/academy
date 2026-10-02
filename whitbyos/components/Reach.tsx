/**
 * An email address and a phone number that can be used, not only read.
 *
 * Nothing in Whitby sends mail — no mailbox is connected — so `mailto:` is not
 * a placeholder for a feature that is coming, it is the whole mechanism: it
 * hands the address to whatever the person already writes mail in, with the
 * message unwritten and unsent. `tel:` does the same on a phone or a Mac.
 *
 * A screen that prints an address somebody then has to select and copy is
 * asking them to do the one bit of work a browser has always done.
 */
export function EmailLink({ address }: { address: string }) {
  return (
    <a
      href={`mailto:${address}`}
      className="no-underline hover:underline"
      style={{ color: "inherit" }}
      title={`Write to ${address}`}
    >
      {address}
    </a>
  );
}

/**
 * A website, opened rather than read out.
 *
 * People write these without a scheme — "ahmedpartners.co.uk" — and a bare
 * href like that is read as a path on this site, so the link would go to a
 * Whitby page that does not exist. The scheme is added when it is missing and
 * the address is still shown the way it was typed.
 *
 * A new tab, and `noreferrer`: this is somebody else's site, opened from a
 * record of them, and the firm's own URL is not theirs to be told.
 */
export function WebsiteLink({ url }: { url: string }) {
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="no-underline hover:underline"
      style={{ color: "inherit" }}
      title={`Open ${url}`}
    >
      {url}
    </a>
  );
}

export function PhoneLink({ number }: { number: string }) {
  return (
    <a
      href={`tel:${number.replace(/[^\d+]/g, "")}`}
      className="no-underline hover:underline"
      style={{ color: "inherit" }}
      title={`Call ${number}`}
    >
      {number}
    </a>
  );
}
