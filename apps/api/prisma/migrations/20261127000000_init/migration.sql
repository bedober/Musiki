CREATE TYPE "Role" AS ENUM ('LISTENER', 'ARTIST', 'MANAGER', 'LABEL', 'ADMIN');
CREATE TYPE "Plan" AS ENUM ('FREE', 'PREMIUM');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT,
  "displayName" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'LISTENER',
  "plan" "Plan" NOT NULL DEFAULT 'FREE',
  "planExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Artist" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stageName" TEXT NOT NULL,
  "bio" TEXT,
  "imageUrl" TEXT,
  CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Label" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Track" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "artistId" TEXT NOT NULL,
  "albumId" TEXT,
  "audioKey" TEXT NOT NULL,
  "coverUrl" TEXT,
  "durationSeconds" INTEGER NOT NULL,
  "promoDownload" BOOLEAN NOT NULL DEFAULT false,
  "offlineAllowed" BOOLEAN NOT NULL DEFAULT true,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Playlist" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PlaylistTrack" (
  "playlistId" TEXT NOT NULL,
  "trackId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "PlaylistTrack_pkey" PRIMARY KEY ("playlistId","trackId")
);
CREATE TABLE "Download" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "trackId" TEXT NOT NULL,
  "entitlement" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Download_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'UGX',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Artist_userId_key" ON "Artist"("userId");
CREATE UNIQUE INDEX "Download_userId_trackId_key" ON "Download"("userId","trackId");
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");
CREATE INDEX "Track_published_createdAt_idx" ON "Track"("published","createdAt");
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId","createdAt");

ALTER TABLE "Artist" ADD CONSTRAINT "Artist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Track" ADD CONSTRAINT "Track_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Download" ADD CONSTRAINT "Download_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Download" ADD CONSTRAINT "Download_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
