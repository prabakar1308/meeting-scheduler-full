import { Global, Module } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Global()
@Module({
  providers: [
    {
      provide: "PRISMA",
      useValue: new PrismaClient(),
    },
  ],
  exports: ["PRISMA"],
})
export class PrismaModule {}
