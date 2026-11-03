import { Module } from "@nestjs/common";

import { DatabaseModule } from "../platform/database/database.module.js";
import { AccountsController } from "./accounts.controller.js";
import { AccountsService } from "./accounts.service.js";
import { AdminSeed } from "./admin-seed.js";
import { DemoOwnerSeed } from "./demo-owner-seed.js";

@Module({
  controllers: [AccountsController],
  exports: [AccountsService, DemoOwnerSeed],
  imports: [DatabaseModule],
  providers: [AccountsService, AdminSeed, DemoOwnerSeed],
})
export class AccountsModule {}
