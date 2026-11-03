import { Module } from "@nestjs/common";

import { AccountsModule } from "../identity/accounts.module.js";
import { DatabaseModule } from "../platform/database/database.module.js";
import { AdminController } from "./admin.controller.js";
import { AdminService } from "./admin.service.js";

@Module({
  controllers: [AdminController],
  imports: [AccountsModule, DatabaseModule],
  providers: [AdminService],
})
export class AdminModule {}
