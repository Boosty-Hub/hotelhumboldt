-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "opportunityId" TEXT NOT NULL,
    "eventId" TEXT,
    "signerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "issueDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME,
    "agreementDate" DATETIME,
    "publicToken" TEXT NOT NULL,
    "publicViewedAt" DATETIME,
    "approvedByName" TEXT,
    "approvedAt" DATETIME,
    "rejectionNote" TEXT,
    "clientMessage" TEXT,
    "legalConditions" TEXT,
    "taxPct" REAL NOT NULL DEFAULT 16,
    "taxEnabled" BOOLEAN NOT NULL DEFAULT true,
    "servicePct" REAL NOT NULL DEFAULT 10,
    "serviceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "depositPct" REAL NOT NULL DEFAULT 10,
    "depositEnabled" BOOLEAN NOT NULL DEFAULT true,
    "igtfPct" REAL NOT NULL DEFAULT 3,
    "igtfEnabled" BOOLEAN NOT NULL DEFAULT true,
    "subtotalMisc" REAL NOT NULL DEFAULT 0,
    "subtotalTransfers" REAL NOT NULL DEFAULT 0,
    "subtotalFood" REAL NOT NULL DEFAULT 0,
    "subtotalSpaces" REAL NOT NULL DEFAULT 0,
    "serviceAmount" REAL NOT NULL DEFAULT 0,
    "taxAmount" REAL NOT NULL DEFAULT 0,
    "totalUsd" REAL NOT NULL DEFAULT 0,
    "depositAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quote_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Quote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quote_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Quote" ("agreementDate", "approvedAt", "approvedByName", "clientMessage", "createdAt", "currency", "depositAmount", "depositEnabled", "depositPct", "eventId", "id", "igtfEnabled", "igtfPct", "issueDate", "legalConditions", "number", "opportunityId", "publicToken", "publicViewedAt", "rejectionNote", "serviceAmount", "serviceEnabled", "servicePct", "signerId", "status", "subtotalFood", "subtotalMisc", "subtotalSpaces", "subtotalTransfers", "taxAmount", "taxPct", "totalUsd", "updatedAt", "validUntil", "version") SELECT "agreementDate", "approvedAt", "approvedByName", "clientMessage", "createdAt", "currency", "depositAmount", "depositEnabled", "depositPct", "eventId", "id", "igtfEnabled", "igtfPct", "issueDate", "legalConditions", "number", "opportunityId", "publicToken", "publicViewedAt", "rejectionNote", "serviceAmount", "serviceEnabled", "servicePct", "signerId", "status", "subtotalFood", "subtotalMisc", "subtotalSpaces", "subtotalTransfers", "taxAmount", "taxPct", "totalUsd", "updatedAt", "validUntil", "version" FROM "Quote";
DROP TABLE "Quote";
ALTER TABLE "new_Quote" RENAME TO "Quote";
CREATE UNIQUE INDEX "Quote_number_key" ON "Quote"("number");
CREATE UNIQUE INDEX "Quote_publicToken_key" ON "Quote"("publicToken");
CREATE INDEX "Quote_status_idx" ON "Quote"("status");
CREATE INDEX "Quote_opportunityId_idx" ON "Quote"("opportunityId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
