import Link from "@docusaurus/Link";
import useBaseUrl from "@docusaurus/useBaseUrl";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import type { ReactNode } from "react";

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  const logoUrl = useBaseUrl("img/logo.svg");

  return (
    <Layout title="Home" description={siteConfig.tagline}>
      <header className="conduit-hero">
        <div className="conduit-hero__inner">
          <img
            className="conduit-hero__logo"
            src={logoUrl}
            alt="Conduit logo"
            width={120}
            height={120}
            decoding="async"
          />
          <Heading as="h1" className="conduit-hero__title hero__title">
            {siteConfig.title}
          </Heading>
          <p className="conduit-hero__subtitle hero__subtitle">{siteConfig.tagline}</p>
          <div className="conduit-hero__actions">
            <Link
              className="button button--primary button--lg"
              to="/docs/guides/getting-started"
            >
              Get started
            </Link>
            <Link
              className="button button--outline button--lg"
              href="https://github.com/DiyorUmarkulov/conduit"
            >
              View on GitHub
            </Link>
          </div>
        </div>
      </header>
      <main className="container margin-vert--xl">
        <section className="row">
          <div className="col col--8 col--offset-2">
            <Heading as="h2">What is Conduit?</Heading>
            <p>
              Conduit is an operation bus for backend <code>COMMAND</code> and <code>EVENT</code> delivery with
              at-least-once semantics, explicit idempotency expectations, semver-aware routing, and pluggable
              transports: in-memory, transactional outbox, Kafka, RabbitMQ, and NATS.
            </p>
            <p>
              Published packages use the <code>@theconduit/*</code> scope. Guides in this site mirror the{" "}
              <code>docs/</code> folder in the repository.
            </p>
          </div>
        </section>

        <section className="conduit-learn margin-vert--xl">
          <div className="row">
            <div className="col col--8 col--offset-2 text--center margin-bottom--md">
              <Heading as="h2">Learn in order</Heading>
              <p className="conduit-learn__intro">
                Start with the big picture, then run the minimal in-memory bus, then pick a transport for production.
              </p>
            </div>
          </div>
          <div className="row">
            <div className="col col--4">
              <article className="conduit-card">
                <h3 className="conduit-card__title">How it works</h3>
                <p className="conduit-card__text">
                  Flowcharts and sequence diagrams: dispatch, middleware, provider, handler, and outbox relay.
                </p>
                <Link className="conduit-card__link" to="/docs/guides/how-conduit-works">
                  Open guide →
                </Link>
              </article>
            </div>
            <div className="col col--4">
              <article className="conduit-card">
                <h3 className="conduit-card__title">Getting started</h3>
                <p className="conduit-card__text">
                  Install, wire <code>InMemoryProvider</code>, register handlers, and send your first envelope.
                </p>
                <Link className="conduit-card__link" to="/docs/guides/getting-started">
                  Follow the tutorial →
                </Link>
              </article>
            </div>
            <div className="col col--4">
              <article className="conduit-card">
                <h3 className="conduit-card__title">Choosing a transport</h3>
                <p className="conduit-card__text">
                  When to use in-memory, SQL outbox, Kafka, RabbitMQ, or NATS — and what changes in your app.
                </p>
                <Link className="conduit-card__link" to="/docs/guides/choosing-provider">
                  Compare options →
                </Link>
              </article>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
