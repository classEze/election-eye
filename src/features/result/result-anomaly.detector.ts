import { Injectable } from '@nestjs/common';
import { CreateResultDto } from './result.dto';

export enum AnomalyType {
  ARITHMETIC_MISMATCH = 'ARITHMETIC_MISMATCH',
  OVER_VOTING = 'OVER_VOTING',
  TURNOUT_OVER_REGISTERED = 'TURNOUT_OVER_REGISTERED',
  HIGH_REJECTION_RATE = 'HIGH_REJECTION_RATE',
}

export interface AnomalyReport {
  hasAnomalies: boolean;
  flags: AnomalyType[];
  details: string[];
}

@Injectable()
export class ResultAnomalyDetector {
  /**
   * Scans a submitted result for mathematical and statistical irregularities.
   */
  detect(dto: CreateResultDto): AnomalyReport {
    const flags: AnomalyType[] = [];
    const details: string[] = [];

    const totalValidVotes = Number(dto.totalValidVotes || 0);
    const rejectedVotes = Number(dto.rejectedVotes || 0);
    const totalVotesCast = totalValidVotes + rejectedVotes;
    const accredited =
      dto.totalAccreditedVoters != null
        ? Number(dto.totalAccreditedVoters)
        : null;
    const registered =
      dto.totalRegisteredVoters != null
        ? Number(dto.totalRegisteredVoters)
        : null;

    // 1. Arithmetic Mismatch: Sum of individual party breakdown votes vs totalValidVotes
    if (dto.partyBreakdown && dto.partyBreakdown.length > 0) {
      const partyVotesSum = dto.partyBreakdown.reduce(
        (acc, item) => acc + Number(item.votes || 0),
        0,
      );

      if (partyVotesSum !== totalValidVotes) {
        flags.push(AnomalyType.ARITHMETIC_MISMATCH);
        details.push(
          `Arithmetic mismatch: Sum of party votes (${partyVotesSum}) does not equal total valid votes (${totalValidVotes}).`,
        );
      }
    }

    // 2. Over-voting: Total votes cast (Valid + Rejected) exceeds Accredited voters
    if (accredited !== null && accredited > 0) {
      if (totalVotesCast > accredited) {
        flags.push(AnomalyType.OVER_VOTING);
        details.push(
          `Over-voting detected: Total votes cast (${totalVotesCast}) exceeds total accredited voters (${accredited}).`,
        );
      }
    }

    // 3. Turnout Over Registered Voters: Accredited or Cast votes exceeds total registered voters
    if (registered !== null && registered > 0) {
      if (accredited !== null && accredited > registered) {
        flags.push(AnomalyType.TURNOUT_OVER_REGISTERED);
        details.push(
          `Turnout exceeds registered voters: Accredited voters (${accredited}) exceeds registered voters (${registered}).`,
        );
      } else if (totalVotesCast > registered) {
        flags.push(AnomalyType.TURNOUT_OVER_REGISTERED);
        details.push(
          `Turnout exceeds registered voters: Total votes cast (${totalVotesCast}) exceeds registered voters (${registered}).`,
        );
      }
    }

    // 4. High Rejection Rate: Rejected votes constitute > 20% of total votes cast
    if (totalVotesCast >= 10 && rejectedVotes > 0) {
      const rejectionRate = rejectedVotes / totalVotesCast;
      if (rejectionRate > 0.2) {
        const percentage = (rejectionRate * 100).toFixed(1);
        flags.push(AnomalyType.HIGH_REJECTION_RATE);
        details.push(
          `High rejection rate detected: ${rejectedVotes} rejected votes (${percentage}% of ${totalVotesCast} total votes cast).`,
        );
      }
    }

    return {
      hasAnomalies: flags.length > 0,
      flags,
      details,
    };
  }
}
