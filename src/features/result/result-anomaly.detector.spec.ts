import { ResultAnomalyDetector, AnomalyType } from './result-anomaly.detector';
import { CreateResultDto } from './result.dto';

describe('ResultAnomalyDetector', () => {
  let detector: ResultAnomalyDetector;

  beforeEach(() => {
    detector = new ResultAnomalyDetector();
  });

  it('should detect no anomalies for a completely valid submission with votes key', () => {
    const dto: CreateResultDto = {
      pollingUnitId: 1179,
      electoralOfficeId: 19,
      politicalPartyId: 5,
      totalValidVotes: 1200,
      rejectedVotes: 200,
      totalAccreditedVoters: 1500,
      partyBreakdown: [
        { politicalPartyId: 5, votes: 1000 },
        { politicalPartyId: 7, votes: 200 },
      ],
    } as CreateResultDto;

    const report = detector.detect(dto, 2000, 1500);

    expect(report.hasAnomalies).toBe(false);
    expect(report.flags).toHaveLength(0);
    expect(report.details).toHaveLength(0);
  });

  it('should support legacy votesReceived key without throwing arithmetic mismatch', () => {
    const dto = {
      pollingUnitId: 1179,
      electoralOfficeId: 19,
      politicalPartyId: 5,
      totalValidVotes: 1200,
      rejectedVotes: 100,
      totalAccreditedVoters: 1500,
      partyBreakdown: [
        { politicalPartyId: 5, votesReceived: 1000 },
        { politicalPartyId: 7, votesReceived: 200 },
      ],
    } as unknown as CreateResultDto;

    const report = detector.detect(dto, 2000, 1500);

    expect(report.hasAnomalies).toBe(false);
    expect(report.flags).toHaveLength(0);
  });

  it('should flag ARITHMETIC_MISMATCH when party breakdown sum differs from totalValidVotes', () => {
    const dto: CreateResultDto = {
      pollingUnitId: 1179,
      electoralOfficeId: 19,
      politicalPartyId: 5,
      totalValidVotes: 1200,
      rejectedVotes: 50,
      totalAccreditedVoters: 1500,
      partyBreakdown: [
        { politicalPartyId: 5, votes: 900 },
        { politicalPartyId: 7, votes: 200 },
      ], // sum = 1100 != 1200
    } as CreateResultDto;

    const report = detector.detect(dto, 2000, 1500);

    expect(report.hasAnomalies).toBe(true);
    expect(report.flags).toContain(AnomalyType.ARITHMETIC_MISMATCH);
    expect(report.details[0]).toContain('Arithmetic mismatch: Sum of party votes (1100) does not equal total valid votes (1200)');
  });

  it('should flag OVER_VOTING when total votes cast exceeds accredited voters', () => {
    const dto: CreateResultDto = {
      pollingUnitId: 1179,
      electoralOfficeId: 19,
      politicalPartyId: 5,
      totalValidVotes: 1200,
      rejectedVotes: 200, // totalVotesCast = 1400
      totalAccreditedVoters: 1300, // accredited = 1300 < 1400
      partyBreakdown: [
        { politicalPartyId: 5, votes: 1000 },
        { politicalPartyId: 7, votes: 200 },
      ],
    } as CreateResultDto;

    const report = detector.detect(dto, 2000);

    expect(report.hasAnomalies).toBe(true);
    expect(report.flags).toContain(AnomalyType.OVER_VOTING);
    expect(report.details[0]).toContain('Over-voting detected: Total votes cast (1400) exceeds total accredited voters (1300)');
  });

  it('should use accreditedVotersFallback when dto.totalAccreditedVoters is omitted', () => {
    const dto: CreateResultDto = {
      pollingUnitId: 1179,
      electoralOfficeId: 19,
      politicalPartyId: 5,
      totalValidVotes: 1200,
      rejectedVotes: 200, // totalVotesCast = 1400
      partyBreakdown: [
        { politicalPartyId: 5, votes: 1000 },
        { politicalPartyId: 7, votes: 200 },
      ],
    } as CreateResultDto;

    // Fallback accredited voters = 1300 -> totalVotesCast (1400) > 1300
    const report = detector.detect(dto, 2000, 1300);

    expect(report.hasAnomalies).toBe(true);
    expect(report.flags).toContain(AnomalyType.OVER_VOTING);
  });

  it('should flag TURNOUT_OVER_REGISTERED when votes cast exceeds registered voters', () => {
    const dto: CreateResultDto = {
      pollingUnitId: 1179,
      electoralOfficeId: 19,
      politicalPartyId: 5,
      totalValidVotes: 1200,
      rejectedVotes: 200, // totalVotesCast = 1400
      totalAccreditedVoters: 800,
      partyBreakdown: [
        { politicalPartyId: 5, votes: 1000 },
        { politicalPartyId: 7, votes: 200 },
      ],
    } as CreateResultDto;

    // Registered voters = 1000, totalVotesCast = 1400, accredited = 800
    const report = detector.detect(dto, 1000, 800);

    expect(report.hasAnomalies).toBe(true);
    expect(report.flags).toContain(AnomalyType.TURNOUT_OVER_REGISTERED);
    expect(report.details.some(d => d.includes('Turnout exceeds registered voters: Total votes cast (1400) exceeds registered voters (1000)'))).toBe(true);
  });

  it('should NOT flag TURNOUT_OVER_REGISTERED if registered voters is null or 0', () => {
    const dto: CreateResultDto = {
      pollingUnitId: 1179,
      electoralOfficeId: 19,
      politicalPartyId: 5,
      totalValidVotes: 1200,
      rejectedVotes: 200,
      partyBreakdown: [
        { politicalPartyId: 5, votes: 1000 },
        { politicalPartyId: 7, votes: 200 },
      ],
    } as CreateResultDto;

    const reportNull = detector.detect(dto, null);
    expect(reportNull.flags).not.toContain(AnomalyType.TURNOUT_OVER_REGISTERED);

    const reportZero = detector.detect(dto, 0);
    expect(reportZero.flags).not.toContain(AnomalyType.TURNOUT_OVER_REGISTERED);
  });

  it('should flag HIGH_REJECTION_RATE when rejected votes exceed 20% of votes cast', () => {
    const dto: CreateResultDto = {
      pollingUnitId: 1179,
      electoralOfficeId: 19,
      politicalPartyId: 5,
      totalValidVotes: 70,
      rejectedVotes: 30, // 30 / 100 = 30% > 20%
      totalAccreditedVoters: 100,
      partyBreakdown: [
        { politicalPartyId: 5, votes: 70 },
      ],
    } as CreateResultDto;

    const report = detector.detect(dto, 200, 100);

    expect(report.hasAnomalies).toBe(true);
    expect(report.flags).toContain(AnomalyType.HIGH_REJECTION_RATE);
    expect(report.details[0]).toContain('High rejection rate detected: 30 rejected votes (30.0% of 100 total votes cast)');
  });
});
