-- CreateTable
CREATE TABLE "performance_certificates" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "certificateName" TEXT,
    "certificateUrl" TEXT,

    CONSTRAINT "performance_certificates_pkey" PRIMARY KEY ("id")
);
