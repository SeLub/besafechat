import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamMembership } from './team-membership.entity';
import { Team } from './team.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Team, TeamMembership])],
  exports: [TypeOrmModule],
})
export class TeamModule {}
