import { Module } from "@nestjs/common";

import { AccountsModule } from "../identity/accounts.module.js";
import { DatabaseModule } from "../platform/database/database.module.js";
import { OwnerController } from "./owner.controller.js";
import { OwnerService } from "./owner.service.js";

@Module({
  controllers: [OwnerController],
  imports: [AccountsModule, DatabaseModule],
  providers: [OwnerService],
})
export class OwnerModule {}
