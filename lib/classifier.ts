export interface ClassificationResult {
  category: string;
  intent: string;
  icon: string;
  confidence: number;
}

interface IntentRule {
  category: string;
  intent: string;
  icon: string;
  regex: RegExp;
}

// Intent rules ported from faq_data_cleaning/clean_faq_questions.py
const INTENT_RULES: IntentRule[] = [
  // --- 1. SALARY, PAYOUTS & RATES ---
  {
    category: "Salary, Payouts & Rates",
    intent: "Salary Delay & Payout Release Status",
    icon: "💰",
    regex: /(wala pa din.*(sahod|payout)|may (naka|update.*)?(sahod|payout)|delayed?.*(sahod|payout)|pending.*(sahod|payout)|kelan.*(papasok|sahod|payout)|kailan.*(sahod|payout)|update.*sahod|distribution.*sahod|when kaya papasok|na send na ba.*sahod|status.*sending|bakit delay.*sahod|no update sa sahod|ilang days.*delay|wala pa ding sahod|kailan papasok sahod)/i
  },
  {
    category: "Salary, Payouts & Rates",
    intent: "Cut-off Schedules & Payout Dates",
    icon: "💰",
    regex: /(kailan.*next cut ?off|kelan.*cut ?off|cut ?off.*kailan|cut ?off.*kelan|tuwing kailan.*cut ?off|kada 15 days|pano ba pasahod|schedule.*sahod|kelan ang cut off|petsa ng sahod|tuwing kelan.*sahod)/i
  },
  {
    category: "Salary, Payouts & Rates",
    intent: "Withdrawal Process & Minimum Balance",
    icon: "💰",
    regex: /(minimum withdrawal|withdraw.*(d2|dito|ba)|withdrawal.*bank|payout via bank|withdraw.*wallet|paano mag withdraw|pano mag withdraw|issue.*with withdrawal|naka withdraw na ba)/i
  },
  {
    category: "Salary, Payouts & Rates",
    intent: "Task Rates & Earnings Computation",
    icon: "💰",
    regex: /(rate na map|rate sa centerline|magkano.*rate|ano mas malaki.*rate|sahurin.*task|magkano sahod|computation.*sahod|rate per task|rate ng map|magkano kita|per hour)/i
  },
  {
    category: "Salary, Payouts & Rates",
    intent: "Task Count / Hours Eligibility for Payout",
    icon: "💰",
    regex: /(hindi po ba talaga nasasahuran pag nasa \d+|counted na po ba|magkaka sahud b if|kahit kunti lang nagawa|sahod.*task count|sahod.*minimum task|ilang hours.*para sumahod|minimum hours)/i
  },

  // --- 2. GINGER SOFTWARE & TECH ISSUES ---
  {
    category: "Ginger App & Technical",
    intent: "App Freeze, Crash & USER Folder Cleanup",
    icon: "🛠️",
    regex: /(not responding.*ginger|ginger.*not responding|nag zoom.*not responding|freeze|fatal crash.*software|crash.*3d|clear.*user folder|delete.*user folder|linis.*files|mag back to zero.*delete user|hang.*ginger|black screen.*ginger)/i
  },
  {
    category: "Ginger App & Technical",
    intent: "Software Auto-Update & Version Errors",
    icon: "🛠️",
    regex: /(invalid software version|software will upgrade itself|update.*ginger|ginger.*update|stuck.*update|matagal.*update.*ginger|upgrade itself|download failed.*update|failed to update)/i
  },
  {
    category: "Ginger App & Technical",
    intent: "Download, VC-Redist & Installation Setup",
    icon: "🛠️",
    regex: /(paano.*download.*ginger|pano.*download.*ginger|download.*vc[- ]?redists?|vc redists?|extract.*ginger|7 zip|install.*ginger|paano ma-download ulit ginger|saan idownload ang ginger|link.*download)/i
  },
  {
    category: "Ginger App & Technical",
    intent: "VPN Requirement & Server Location",
    icon: "🛠️",
    regex: /(use vpn|vpn.*ginger|ginger.*vpn|anong server.*vpn|nearest server|singapore.*server|need ba.*vpn|proton vpn|bakit kailangan ng vpn)/i
  },
  {
    category: "Ginger App & Technical",
    intent: "Mobile Phone / CP Compatibility",
    icon: "🛠️",
    regex: /(ginger.*sa (cp|cellphone|phone|android|ios)|pwede.*(cp|cellphone)|download.*ginger sa cp|applicable.*cp|pwede ba sa cellphone|pwede ba sa phone|pwede sa tablet)/i
  },

  // --- 3. TRAINING & ONBOARDING ---
  {
    category: "Training & Onboarding",
    intent: "Pausing Training & Resuming Next Day",
    icon: "🎓",
    regex: /(ipagpatuloy bukas|tuloy bukas|pwede ba bukas|bukas nalang|pwede.*bukas na lang|at your own (pace|phase)|pause.*training|pwede ba bukas ituloy|ituloy mamaya)/i
  },
  {
    category: "Training & Onboarding",
    intent: "Training Timer Timeout & Reset Rules",
    icon: "🎓",
    regex: /(naabotan ng time|mag restart ba|restart.*training|oras.*training|timer.*training|uulit sa simula|pag naubusan ng time|countdown timer)/i
  },
  {
    category: "Training & Onboarding",
    intent: "Task Submission Shortcuts (Ctrl+A / Ctrl+D / Save)",
    icon: "🎓",
    regex: /(pano.*submit.*training|paano.*submit.*training|ctrl a|ctrl d|ctrl t|click na ako ng save.*walang nangyayari|submit.*task|after isubmit po ba|paano isubmit)/i
  },
  {
    category: "Training & Onboarding",
    intent: "Next Training Module & Unlocking Progress",
    icon: "🎓",
    regex: /(next training|san makikita.*next training|saan.*next training|tapos na po sa.*training|module 2|saan makikita.*module|roof training|landcover training|standard bldg|paano pumunta sa next training|next step matapos training)/i
  },
  {
    category: "Training & Onboarding",
    intent: "Pre-Course & Onboarding Completion Status",
    icon: "🎓",
    regex: /(natapos na.*pre-course|done.*training|tapos na.*module|tapusin.*module|onboarding progress|ilang days na po ko done sa training|nakapasa na sa training)/i
  },

  // --- 4. ACCOUNT & CREDENTIALS ---
  {
    category: "Account & Credentials",
    intent: "Ginger Login Credentials (Username & Password)",
    icon: "🔑",
    regex: /(log ?in sa ginger|login.*ginger|user.*password.*ginger|saan.*makukuha.*login|username at password.*log ?in|credentials.*ginger|meron na kayo username at password|ayaw mag login sa ginger)/i
  },
  {
    category: "Account & Credentials",
    intent: "Labeler ID Location in Dashboard",
    icon: "🔑",
    regex: /(labeler id|saan.*labeler id|san.*labeler id|account info.*labeler id|nasaan.*labeler id|saan makikita ang labeler id|ano ang labeler id)/i
  },
  {
    category: "Account & Credentials",
    intent: "Account Info Locked / Pending Modules",
    icon: "🔑",
    regex: /(naka lock.*account info|lock.*acc info|naka lock pa yung account|unlock.*account info|bakit naka lock ang account info|paano ma unlock account info)/i
  },
  {
    category: "Account & Credentials",
    intent: "Expired / Inactive Account Reactivation",
    icon: "🔑",
    regex: /(nag expired.*account|expired.*account|nawalan.*internet.*expired|maibalik sa dati.*account|reactivate.*account|bka pwede po maibalik|na deactivate account)/i
  },
  {
    category: "Account & Credentials",
    intent: "OTP & Email Verification Code",
    icon: "🔑",
    regex: /(nakatang(g)?ap ba kayo ng otp|otp.*disabled|verification code|email otp|walang otp|hindi dumadating ang otp)/i
  },

  // --- 5. PROJECTS & TASKS ---
  {
    category: "Projects & Tasks",
    intent: "Checker & Judger Assignment Timeline",
    icon: "📋",
    regex: /(kelan.*checker|kailan.*checker|mag kakaroon ng checker|wla pang checker|no checker|judger|kailan.*judger|walang checker|kelan po kaya ako mag kakaroon ng checker|sino checker ko)/i
  },
  {
    category: "Projects & Tasks",
    intent: "Task Checking Duration & Approval",
    icon: "📋",
    regex: /(matagal ba ckecking|matagal ba checking|hintayin.*macheck|check.*task|kailan macheck|makikita ng checker ang actual task|ilang oras bago ma check)/i
  },
  {
    category: "Projects & Tasks",
    intent: "Missing Active Projects in Dashboard",
    icon: "📋",
    regex: /(walang lumalabas.*(active project|projects)|walang nalabas.*project|wala kac lumalabas na mga active project|saan.*active project|3d lang ba project ngayon|3d project lang po ba|nawala mga project)/i
  },
  {
    category: "Projects & Tasks",
    intent: "Live Task Pulling Eligibility",
    icon: "📋",
    regex: /(pede na ba maka take ng mga live task|pull.*live task.*kahit|pullback|puro pullback|makapag pull kasi ako sa  landcover|paano mag pull ng live task)/i
  },
  {
    category: "Projects & Tasks",
    intent: "Project Verification & Bug Reporting",
    icon: "📋",
    regex: /(paverify for Standrard Building|pano mag report ng project|verify.*building|overlap.*bura|road overlap)/i
  },

  // --- 6. DASHBOARD & SYSTEM FEATURES ---
  {
    category: "Dashboard & Platform",
    intent: "Performance Query & Hours Monitoring",
    icon: "📊",
    regex: /(walang lumalabas.*performance query|performance query|hindi lumalabas.*stats|bakit zero.*task|may dashboard ba para mamonitor|ilan hours kana|machecheck ang oras)/i
  },
  {
    category: "Dashboard & Platform",
    intent: "Attendance Session & Sign-in",
    icon: "📊",
    regex: /(panu po magka attendance|attendance session|attendance dito|attendance password|paano magka attendance|oras ng attendance)/i
  },
  {
    category: "Dashboard & Platform",
    intent: "Wallet Post, Loyalty Points & Support Tickets",
    icon: "📊",
    regex: /(loyalty points|working na ba loyalty|wallet.*post|support option|update na po ba sa mga wallet|loyalty rewards)/i
  }
];

// Broad category fallback keywords
const BROAD_CATEGORY_KEYWORDS: { category: string; icon: string; keywords: string[] }[] = [
  {
    category: "Salary, Payouts & Rates",
    icon: "💰",
    keywords: ["sahod", "sweldo", "payout", "cut off", "cutoff", "withdrawal", "withdraw", "rate", "kita", "pera", "earning", "dollars"]
  },
  {
    category: "Ginger App & Technical",
    icon: "🛠️",
    keywords: ["ginger", "freeze", "crash", "vpn", "vc-redist", "update", "cellphone", "android", "7zip", "extract", "error"]
  },
  {
    category: "Training & Onboarding",
    icon: "🎓",
    keywords: ["training", "module", "onboarding", "precourse", "pre-course", "exam", "quiz", "ctrl+a", "bukas", "timer"]
  },
  {
    category: "Account & Credentials",
    icon: "🔑",
    keywords: ["labeler id", "password", "username", "login", "log in", "credentials", "otp", "locked", "account info"]
  },
  {
    category: "Projects & Tasks",
    icon: "📋",
    keywords: ["checker", "judger", "active project", "live task", "pullback", "landcover", "building", "task", "map"]
  },
  {
    category: "Dashboard & Platform",
    icon: "📊",
    keywords: ["attendance", "performance query", "loyalty", "wallet", "hours", "stats", "dashboard"]
  }
];

/**
 * Classifies an incoming user inquiry into operational category and intent.
 */
export function classifyQuestion(message: string): ClassificationResult {
  const cleanMsg = message.trim();

  // 1. Check exact intent rules from cleaned dataset
  for (const rule of INTENT_RULES) {
    if (rule.regex.test(cleanMsg)) {
      return {
        category: rule.category,
        intent: rule.intent,
        icon: rule.icon,
        confidence: 0.95
      };
    }
  }

  // 2. Check broad keyword matching
  const lowerMsg = cleanMsg.toLowerCase();
  for (const group of BROAD_CATEGORY_KEYWORDS) {
    for (const kw of group.keywords) {
      if (lowerMsg.includes(kw)) {
        return {
          category: group.category,
          intent: `General Inquiry (${group.category})`,
          icon: group.icon,
          confidence: 0.75
        };
      }
    }
  }

  // 3. Social / Conversational checks
  const socialPhrases = ["hi", "hello", "hey", "kamusta", "kumusta", "salamat", "thanks", "thank you", "magandang"];
  if (socialPhrases.some(p => lowerMsg.includes(p))) {
    return {
      category: "General Inquiries & Community",
      intent: "Social Greeting & Politeness",
      icon: "💬",
      confidence: 0.9
    };
  }

  // 4. Default fallback
  return {
    category: "General Inquiries & Community",
    intent: "Xfnite Platform Overview",
    icon: "💬",
    confidence: 0.5
  };
}
