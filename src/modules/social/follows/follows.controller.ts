import { Controller, Get, Post, Delete, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { FollowsService } from './follows.service';

@ApiTags('social-follows')
@Controller('follows')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FollowsController {
  constructor(private followsService: FollowsService) {}

  @Post(':userId')
  @ApiOperation({ summary: 'Follow a user' })
  follow(@CurrentUser('id') me: string, @Param('userId') userId: string) {
    return this.followsService.follow(me, userId);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Unfollow a user' })
  unfollow(@CurrentUser('id') me: string, @Param('userId') userId: string) {
    return this.followsService.unfollow(me, userId);
  }

  @Get('following')
  @ApiOperation({ summary: 'List users I follow' })
  following(@CurrentUser('id') me: string) {
    return this.followsService.getFollowing(me);
  }

  @Get('followers')
  @ApiOperation({ summary: 'List my followers' })
  followers(@CurrentUser('id') me: string) {
    return this.followsService.getFollowers(me);
  }

  @Get('feed')
  @ApiOperation({ summary: 'Activity feed from followed users' })
  feed(@CurrentUser('id') me: string) {
    return this.followsService.getFeed(me);
  }

  @Post('blend/:userId')
  @ApiOperation({ summary: 'Create blend playlist with another user' })
  blend(@CurrentUser('id') me: string, @Param('userId') userId: string) {
    return this.followsService.blend(me, userId);
  }
}
