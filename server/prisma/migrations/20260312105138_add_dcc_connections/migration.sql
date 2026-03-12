-- CreateTable
CREATE TABLE "dcc_connections" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "appType" TEXT NOT NULL,
    "host" TEXT NOT NULL DEFAULT 'localhost',
    "port" INTEGER NOT NULL,
    "transport" TEXT NOT NULL DEFAULT 'sse',
    "autoConnect" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
