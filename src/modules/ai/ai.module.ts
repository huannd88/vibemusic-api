import { Global, Module } from '@nestjs/common';
import { AiProviderService } from './ai-provider.service';
// Phase 2
import { RecommendationModule } from './recommendation/recommendation.module';
import { MoodModule } from './mood/mood.module';
import { ContextModule } from './context/context.module';
// Phase 3
import { DjModule } from './dj/dj.module';
import { VoiceModule } from './voice/voice.module';
import { KaraokeModule } from './karaoke/karaoke.module';
import { HumModule } from './hum/hum.module';
import { MemoryModule } from './memory/memory.module';
// Phase 5
import { AutoPlayModule } from './auto/auto-play.module';

@Global()
@Module({
  imports: [
    // Phase 2
    RecommendationModule,
    MoodModule,
    ContextModule,
    // Phase 3
    DjModule,
    VoiceModule,
    KaraokeModule,
    HumModule,
    MemoryModule,
    // Phase 5
    AutoPlayModule,
  ],
  providers: [AiProviderService],
  exports: [AiProviderService],
})
export class AiModule {}

