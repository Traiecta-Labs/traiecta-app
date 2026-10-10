"use client";

import Link from "next/link";
import { use, useEffect, useState, type ReactElement } from "react";
import { ExternalLink } from "lucide-react";
import { Column, Footer, Header, Main, Shell } from "../../../components/chrome";
import { StageLamps } from "../../../components/transfer/StageLamps";
import { fetchTransferByTx, getRouteName, type FormattedTransfer } from "../../../api";
import { getExplorerUrl } from "../../../lib/format";
import { buildStages, getStageClass } from "../../../lib/transfer-stages";
import styles from "./page.module.css";

interface PageProps {
  readonly params: Promise<{ readonly txHash: string }>;
}

export default function TransferDetailPage({ params }: PageProps): ReactElement {
  const { txHash } = use(params);
  const [transfer, setTransfer] = useState<FormattedTransfer | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    void fetchTransferByTx(txHash).then((res) => {
      if (active) {
        setTransfer(res);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [txHash]);

  return (
    <Shell>
      <Header network="stellar testnet" />
      <Main>
        <Column>
          <nav className={styles.topNav} aria-label="Breadcrumb">
            <Link href="/transfers" className={styles.backLink}>
              Back to Transfer registry
            </Link>
          </nav>

          {loading ? (
            <div className={styles.errorState}>Loading transfer details...</div>
          ) : !transfer ? (
            <div className={styles.errorState}>
              <h2 className="heading">Transfer not found</h2>
              <p className="prose">
                No transfer record was found matching transaction hash {txHash}.
              </p>
              <Link href="/transfers" className={styles.backLink}>
                Return to transfer list
              </Link>
            </div>
          ) : (
            <>
              <div className={styles.headerBlock}>
                <div className={styles.titleRow}>
                  <h1 className="title">Transfer inspector</h1>
                  <span className={`${styles.stageBadge} ${getStageClass(transfer.stage, styles)}`}>
                    {transfer.stage}
                  </span>
                </div>
                <div className={styles.txHashDisplay}>
                  <span>tx: {transfer.origin.txHash}</span>
                  <a
                    href={getExplorerUrl(transfer.origin.chain, "tx", transfer.origin.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View origin transaction ${transfer.origin.txHash} on ${transfer.origin.chain} explorer`}
                    className={styles.explorerLink}
                  >
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </div>
              </div>

              <section className={styles.lifecycleSection} aria-label="Progress lamps">
                <StageLamps stages={buildStages(transfer.route, transfer.stage)} />
              </section>

              {transfer.claim && (
                <aside className={styles.claimBanner} aria-label="Parked claim notice">
                  <div className={styles.claimBannerTitle}>
                    {transfer.claim.settled ? "Claim settled" : "Parked claim pending recovery"}
                  </div>
                  <div className={styles.claimBannerText}>
                    This delivery holds claim ID {transfer.claim.id}.{" "}
                    {transfer.claim.settled
                      ? "Funds were settled directly to the recipient."
                      : "The destination address is uninitialized or guarded. Anyone can settle this claim permissionlessly."}
                  </div>
                </aside>
              )}

              <div className={styles.panelsGrid}>
                {/* 1. Origin Leg */}
                <section className={styles.legPanel} aria-label="Origin leg details">
                  <div className={styles.panelTitle}>
                    <span>Origin leg</span>
                    <span className={styles.panelBadge}>source</span>
                  </div>

                  <div className={styles.factList}>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>chain</span>
                      <span className={styles.factValue}>{transfer.origin.chain}</span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>sender</span>
                      <span className={styles.factValue}>
                        <span>{transfer.origin.sender}</span>
                        <a
                          href={getExplorerUrl(
                            transfer.origin.chain,
                            "address",
                            transfer.origin.sender,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View sender address ${transfer.origin.sender} on ${transfer.origin.chain} explorer`}
                          className={styles.explorerLink}
                        >
                          <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      </span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>nonce</span>
                      <span className={styles.factValue}>{transfer.origin.nonce}</span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>block ledger</span>
                      <span className={styles.factValue}>{transfer.origin.block}</span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>gross amount</span>
                      <span className={styles.factValue}>
                        {transfer.origin.grossAmount} {transfer.origin.token}
                      </span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>protocol fee</span>
                      <span className={styles.factValue}>
                        {transfer.origin.fee} {transfer.origin.token}
                      </span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>net departure</span>
                      <span className={styles.factValue}>
                        {transfer.origin.netAmount} {transfer.origin.token}
                      </span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>observed at</span>
                      <span className={styles.factValue}>
                        {new Date(transfer.origin.observedAt).toUTCString()}
                      </span>
                    </div>
                  </div>
                </section>

                {/* 2. Rail Attestation */}
                <section className={styles.legPanel} aria-label="Rail attestation details">
                  <div className={styles.panelTitle}>
                    <span>Rail bridge</span>
                    <span className={styles.panelBadge}>{getRouteName(transfer.route)}</span>
                  </div>

                  <div className={styles.factList}>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>route index</span>
                      <span className={styles.factValue}>{transfer.route}</span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>attestation status</span>
                      <span className={styles.factValue}>
                        {transfer.rail?.status ?? "pending observation"}
                      </span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>rail status</span>
                      <span className={styles.factValue}>
                        {transfer.rail?.railStatus ?? "in transit"}
                      </span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>reference</span>
                      <span className={styles.factValue}>
                        {transfer.rail?.reference ?? "not assigned"}
                      </span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>attested at</span>
                      <span className={styles.factValue}>
                        {transfer.rail?.attestedAt
                          ? new Date(transfer.rail.attestedAt).toUTCString()
                          : "awaiting signature"}
                      </span>
                    </div>
                    {transfer.rail?.lastError && (
                      <div className={styles.factItem}>
                        <span className={styles.factLabel}>last error</span>
                        <span className={styles.factValue}>{transfer.rail.lastError}</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* 3. Destination Leg */}
                <section className={styles.legPanel} aria-label="Destination leg details">
                  <div className={styles.panelTitle}>
                    <span>Destination leg</span>
                    <span className={styles.panelBadge}>arrival</span>
                  </div>

                  <div className={styles.factList}>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>chain</span>
                      <span className={styles.factValue}>{transfer.destination.chain}</span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>recipient</span>
                      <span className={styles.factValue}>
                        <span>{transfer.destination.recipient}</span>
                        <a
                          href={getExplorerUrl(
                            transfer.destination.chain,
                            "address",
                            transfer.destination.recipient,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View recipient address ${transfer.destination.recipient} on ${transfer.destination.chain} explorer`}
                          className={styles.explorerLink}
                        >
                          <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      </span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>delivery status</span>
                      <span className={styles.factValue}>
                        {transfer.destination.delivered ? "delivered" : "pending delivery"}
                      </span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>block</span>
                      <span className={styles.factValue}>
                        {transfer.destination.block ?? "unmined"}
                      </span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>destination tx</span>
                      <span className={styles.factValue}>
                        {transfer.destination.txHash ? (
                          <>
                            <span>{transfer.destination.txHash}</span>
                            <a
                              href={getExplorerUrl(
                                transfer.destination.chain,
                                "tx",
                                transfer.destination.txHash,
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`View destination transaction ${transfer.destination.txHash} on ${transfer.destination.chain} explorer`}
                              className={styles.explorerLink}
                            >
                              <ExternalLink size={12} aria-hidden="true" />
                            </a>
                          </>
                        ) : (
                          "not yet submitted"
                        )}
                      </span>
                    </div>
                    <div className={styles.factItem}>
                      <span className={styles.factLabel}>delivered at</span>
                      <span className={styles.factValue}>
                        {transfer.destination.deliveredAt
                          ? new Date(transfer.destination.deliveredAt).toUTCString()
                          : "in flight"}
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
        </Column>
      </Main>
      <Footer />
    </Shell>
  );
}
