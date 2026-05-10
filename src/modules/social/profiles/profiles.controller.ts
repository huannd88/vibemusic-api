import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ProfilesService } from './profiles.service';

@ApiTags('social-profiles')
@Controller('profiles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProfilesController {
  constructor(private profilesService: ProfilesService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get public profile' })
  getProfile(@Param('id') id: string) {
    return this.profilesService.getProfile(id);
  }

  @Get(':id/taste-card')
  @ApiOperation({ summary: 'Get music taste card' })
  getTasteCard(@Param('id') id: string) {
    return this.profilesService.getTasteCard(id);
  }

  @Get(':id/playlists')
  @ApiOperation({ summary: 'Get public playlists' })
  getPublicPlaylists(@Param('id') id: string) {
    return this.profilesService.getPublicPlaylists(id);
  }
}
