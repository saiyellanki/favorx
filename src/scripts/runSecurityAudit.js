const app = require('../api/server');
const securityAudit = require('../utils/securityAudit');
const loggingService = require('../services/loggingService');

async function runAudit() {
  try {
    const results = await securityAudit.runSecurityAudit(app);
    
    console.log('\nSecurity Audit Results:');
    console.log('=======================\n');
    
    for (const [check, result] of Object.entries(results)) {
      console.log(`${check}:`);
      console.log(`Status: ${result.passed ? '✅ Passed' : '❌ Failed'}`);
      if (!result.passed) {
        console.log('Issues:');
        if (result.missingHeaders) console.log('- Missing headers:', result.missingHeaders);
        if (result.missingConfigs) console.log('- Missing configs:', result.missingConfigs);
        if (result.missingLimiters) console.log('- Missing rate limiters:', result.missingLimiters);
        if (result.missingValidators) console.log('- Missing validators:', result.missingValidators);
        if (result.failedChecks) console.log('- Failed checks:', result.failedChecks);
      }
      console.log();
    }
    
    process.exit(0);
  } catch (error) {
    loggingService.error('Security audit failed', { error });
    process.exit(1);
  }
}

runAudit(); 