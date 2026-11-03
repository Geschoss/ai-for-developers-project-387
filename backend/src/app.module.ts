import { type DynamicModule, Module } from "@nestjs/common";

import { AdminModule } from "./administration/admin.module.js";
import { APP_OPTIONS, type AppOptions, AppOptionsModule } from "./app-options.js";
import { AccountsModule } from "./identity/accounts.module.js";
import { OwnerModule } from "./owner/owner.module.js";
import { DatabaseModule } from "./platform/database/database.module.js";
import { HealthController } from "./platform/health.controller.js";
import { SchedulingModule } from "./scheduling/scheduling.module.js";

@Module({})
class AppModule {
  public static forRoot(options: AppOptions): DynamicModule {
    const optionsModule: DynamicModule = {
      exports: [APP_OPTIONS],
      global: true,
      module: AppOptionsModule,
      providers: [{ provide: APP_OPTIONS, useValue: options }],
    };
    return {
      controllers: [HealthController],
      imports: [
        optionsModule,
        DatabaseModule,
        AccountsModule,
        AdminModule,
        OwnerModule,
        SchedulingModule,
      ],
      module: AppModule,
    };
  }
}

export { AppModule };
