-- AlterSequence
ALTER SEQUENCE "Registrationpoint_id_seq" MAXVALUE 9223372036854775807;

-- CreateTable
CREATE TABLE "reciepients" (
    "id" INT4 NOT NULL GENERATED BY DEFAULT AS IDENTITY,
    "fullname" STRING NOT NULL,
    "bank" INT4 NOT NULL,
    "accountnumber" STRING NOT NULL,
    "createdby" INT4 NOT NULL DEFAULT 0,
    "dateadded" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" STRING NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "reciepients_pkey" PRIMARY KEY ("id")
);
