import { Module } from '@nestjs/common';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryCronService } from './discovery-cron.service';
import { DiscoverySyncController } from './discovery-sync.controller';

@Module({
  controllers: [DiscoveryController, DiscoverySyncController],
  providers: [DiscoveryService, DiscoveryCronService],
  exports: [DiscoveryService, DiscoveryCronService],
})
export class DiscoveryModule {}
