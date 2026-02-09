import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { JwtSessionGuard } from '../../session/guards/jwt-session.guard';
import { CurrentHandle } from '../../session/decorators/current-user.decorator';
import { NotificationService } from '../services/notification.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtSessionGuard)
@ApiSecurity('access-token-cookie')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications with pagination' })
  @ApiResponse({ status: 200, description: 'Notifications retrieved successfully' })
  async getNotifications(
    @CurrentHandle() handle: any,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
    @Query('offset', new ParseIntPipe({ optional: true })) offset: number = 0
  ) {
    const notifications = await this.notificationService.getUnreadNotifications(
      handle.id,
      limit,
      offset
    );
    return { notifications };
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(@CurrentHandle() handle: any, @Param('id', ParseUUIDPipe) notificationId: string) {
    await this.notificationService.markAsRead(handle.id, notificationId);
    return { success: true };
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(@CurrentHandle() handle: any) {
    await this.notificationService.markAllAsRead(handle.id);
    return { success: true };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Unread count retrieved successfully' })
  async getUnreadCount(@CurrentHandle() handle: any) {
    const count = await this.notificationService.getUnreadCount(handle.id);
    return { count };
  }
}
