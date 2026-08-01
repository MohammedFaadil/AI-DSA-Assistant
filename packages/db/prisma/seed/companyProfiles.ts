/**
 * Company interview-prep profiles.
 *
 * Content-integrity rule (apply verbatim, keep this comment if this file is
 * ever edited): every field below is general, widely-known industry framing
 * only — never a specific fabricated claim (a date, an interviewer quote, a
 * named team, "this exact question was asked at X on Y"). This content
 * describes how large tech interview processes commonly work in general,
 * not verified insider information about any one company's current process.
 * The curated question sets shown alongside these profiles are sourced
 * entirely from this platform's own ProblemCompany tags (see taxonomy.ts)
 * and are always labelled "commonly practiced for prep", never "asked at" —
 * the same honest, approximate framing every practice platform uses for
 * company-tagged questions.
 */
export interface SeedCompanyProfile {
  companySlug: string;
  overview: string;
  interviewProcess: string;
  focusAreas: string[];
  prepTips: string;
}

export const COMPANY_PROFILES: SeedCompanyProfile[] = [
  {
    companySlug: 'google',
    overview:
      'A large technology company known for search, cloud infrastructure, and consumer software at global scale, with engineering interviews that are widely regarded as setting the template many other tech companies followed.',
    interviewProcess:
      'Large tech companies at this scale typically run several coding rounds focused on data structures and algorithms, often followed by a "Googleyness"/behavioral round and, for more senior levels, a system-design round. Interviewers commonly care about how you communicate your reasoning while solving a problem, not just whether you reach a final answer.',
    focusAreas: ['arrays-and-hashing', 'graphs', 'dynamic-programming', 'binary-search', 'complexity-analysis'],
    prepTips:
      'Practice narrating your thought process out loud as you solve — clarify the problem, state a brute-force approach first, then optimize. Being able to analyze the time and space complexity of your own solution unprompted is consistently valued at this scale of company.',
  },
  {
    companySlug: 'amazon',
    overview:
      'A large technology and logistics company operating e-commerce, cloud computing (AWS), and a wide range of consumer and enterprise products, known for pairing technical interviews with behavioral questions grounded in its published leadership principles.',
    interviewProcess:
      'Interview loops at large e-commerce and cloud companies commonly combine coding rounds (data structures, algorithms, sometimes OOP design) with structured behavioral rounds that ask for specific past examples of your work, often following a "tell me about a time when..." format.',
    focusAreas: ['arrays-and-hashing', 'trees-and-graphs', 'heaps', 'sliding-window', 'design'],
    prepTips:
      'Prepare 2-3 concrete stories from your own experience for common behavioral themes (a disagreement you resolved, a deadline you missed, a time you owned a mistake) — companies with a strong behavioral-interview component reward specific, structured answers over general statements.',
  },
  {
    companySlug: 'meta',
    overview:
      'A large technology company building social platforms and consumer applications at very large scale, with a technical interview process that has historically emphasized speed and correctness under time pressure.',
    interviewProcess:
      'Coding rounds at large consumer-scale platforms often favor being able to solve two moderate problems within a fixed time window, so practicing under a visible timer is common advice. A behavioral round assessing collaboration and impact typically accompanies the technical rounds.',
    focusAreas: ['arrays-and-hashing', 'two-pointers', 'graphs', 'dynamic-programming'],
    prepTips:
      'Time yourself during practice, aiming to reach a working solution to a medium-difficulty problem in well under 20-25 minutes, since pacing across multiple problems in one session is commonly reported as the harder constraint, not any single problem\'s difficulty.',
  },
  {
    companySlug: 'microsoft',
    overview:
      'A large technology company spanning operating systems, productivity software, cloud infrastructure (Azure), and developer tools, with engineering interviews spanning many product teams and a correspondingly wide range of interview styles.',
    interviewProcess:
      'Given the breadth of teams, interview style varies more than at more uniform companies — some loops emphasize algorithmic coding, others weight practical, product-oriented problem solving more heavily. Multiple technical rounds plus a behavioral/culture-fit round is a common overall shape.',
    focusAreas: ['arrays-and-hashing', 'linked-lists', 'trees', 'binary-search', 'design'],
    prepTips:
      'Since team-to-team variation is real at large, multi-product companies, it is worth researching the specific team you are interviewing with in addition to general algorithm practice, when that information is available to you.',
  },
  {
    companySlug: 'apple',
    overview:
      'A large technology company designing consumer hardware, operating systems, and integrated software/services, with engineering interviews that often include a strong systems- or domain-specific component alongside general algorithms.',
    interviewProcess:
      'In addition to general data-structures-and-algorithms rounds, interviews at hardware-and-systems-focused companies commonly include questions probing depth in the specific domain you are applying for (e.g., systems programming, graphics, or embedded software), reflecting the more specialized nature of many roles.',
    focusAreas: ['arrays-and-hashing', 'trees', 'stacks-and-queues', 'complexity-analysis'],
    prepTips:
      'Alongside general practice, review fundamentals specific to the role\'s domain (memory management and concurrency for systems-adjacent roles, for example) since domain depth is commonly weighted alongside general algorithmic ability at specialized-hardware companies.',
  },
  {
    companySlug: 'netflix',
    overview:
      'A large streaming entertainment and technology company operating at very high scale, known for a distinctive engineering culture that publicly emphasizes senior-level autonomy and judgment over rigid process.',
    interviewProcess:
      'Companies with a strong "senior engineer autonomy" culture often weight system design, past project depth, and independent judgment more heavily relative to narrow algorithmic puzzle-solving, compared to earlier-career-focused interview loops.',
    focusAreas: ['arrays-and-hashing', 'graphs', 'system-design-basics', 'complexity-analysis'],
    prepTips:
      'Be ready to discuss a project you drove end-to-end in real depth — the trade-offs you weighed, not just the final architecture — since this style of interview commonly rewards demonstrated judgment over breadth of memorized patterns.',
  },
  {
    companySlug: 'uber',
    overview:
      'A large technology company operating marketplace and logistics platforms (rides, delivery) at global scale, with engineering challenges centered on real-time systems and large-scale distributed data.',
    interviewProcess:
      'Marketplace and logistics platforms at this scale commonly test graph and geometric reasoning (routing, matching problems) alongside standard data-structures rounds, reflecting the kind of problems the underlying systems actually solve.',
    focusAreas: ['graphs', 'heaps', 'sliding-window', 'design'],
    prepTips:
      'Practice graph and shortest-path style problems specifically, since companies solving real-time routing and matching problems commonly draw interview questions from that same problem family.',
  },
  {
    companySlug: 'adobe',
    overview:
      'A large software company known for creative, document, and marketing software, with engineering interviews spanning both classic algorithmic rounds and product-specific technical depth depending on the team.',
    interviewProcess:
      'Interview loops at established software companies with long-lived, widely-used products commonly include a mix of general algorithmic coding rounds and questions about practical software design and debugging, reflecting the maintenance-and-extension nature of much of the work.',
    focusAreas: ['arrays-and-hashing', 'strings', 'stacks-and-queues', 'trees'],
    prepTips:
      'Alongside algorithm practice, be ready to reason about maintaining and extending existing code cleanly, since roles at companies with large, long-lived codebases commonly value that skill as much as writing new algorithms from scratch.',
  },
  {
    companySlug: 'bloomberg',
    overview:
      'A large financial data and technology company providing market data, analytics, and trading tools, where engineering work commonly sits close to financial-domain logic and correctness requirements are unusually strict.',
    interviewProcess:
      'Financial-technology companies commonly place extra weight on correctness, edge-case handling, and precise numerical reasoning during coding rounds, given the cost of subtle bugs in systems handling financial data.',
    focusAreas: ['arrays-and-hashing', 'strings', 'binary-search', 'dynamic-programming'],
    prepTips:
      'Practice explicitly enumerating edge cases (empty input, negative numbers, ties, overflow) before writing code, since interview loops at correctness-sensitive, finance-adjacent companies commonly reward that habit directly.',
  },
  {
    companySlug: 'atlassian',
    overview:
      'A large software company building collaboration and developer-tooling products (issue tracking, documentation, CI/CD), with an engineering culture that publicly emphasizes clear communication and teamwork.',
    interviewProcess:
      'Companies whose products are themselves collaboration tools commonly weight communication and collaborative problem-solving explicitly during interviews, sometimes through a values-based or "working session" style round in addition to standard coding rounds.',
    focusAreas: ['arrays-and-hashing', 'trees', 'stacks-and-queues', 'design'],
    prepTips:
      'Practice thinking out loud and inviting a natural back-and-forth during a mock interview, since collaboration-focused companies commonly evaluate how you communicate about a problem, not only your final solution.',
  },
  {
    companySlug: 'oracle',
    overview:
      'A large enterprise software and cloud infrastructure company with a long history in database systems, where engineering roles commonly involve deep, long-lived, and performance-sensitive codebases.',
    interviewProcess:
      'Established enterprise infrastructure companies commonly test solid fundamentals — data structures, complexity analysis, and sometimes database or systems-specific knowledge — over trend-driven interview formats.',
    focusAreas: ['arrays-and-hashing', 'binary-search', 'recursion', 'complexity-analysis'],
    prepTips:
      'Solid command of core data structures and their complexity trade-offs is commonly enough preparation at fundamentals-focused enterprise companies — depth on a smaller set of core topics can matter more than breadth across many niche patterns.',
  },
  {
    companySlug: 'salesforce',
    overview:
      'A large enterprise cloud software company (customer relationship management and related platforms), where engineering roles commonly span both platform infrastructure and product-facing feature work.',
    interviewProcess:
      'Enterprise SaaS companies commonly run standard algorithmic coding rounds alongside rounds assessing practical API and system design, reflecting the platform-and-product duality common in enterprise software companies.',
    focusAreas: ['arrays-and-hashing', 'hash-maps', 'trees', 'design'],
    prepTips:
      'Alongside algorithms, review basic API and data-modeling design questions, since platform-oriented enterprise companies commonly probe practical system design even at less senior levels.',
  },
  {
    companySlug: 'nvidia',
    overview:
      'A large technology company known for graphics and AI-accelerator hardware along with the software stacks that support them, where many engineering roles sit close to performance-critical, low-level code.',
    interviewProcess:
      'Hardware-and-performance-focused companies commonly weight complexity analysis, memory/cache-aware reasoning, and low-level correctness more heavily than companies whose products are primarily high-level application software.',
    focusAreas: ['bit-manipulation', 'arrays-and-hashing', 'complexity-analysis', 'recursion'],
    prepTips:
      'Be comfortable reasoning explicitly about time AND space complexity, and about bit-level representations, since performance-and-hardware-adjacent companies commonly probe that depth more than typical application-software interviews do.',
  },
  {
    companySlug: 'flipkart',
    overview:
      'A large e-commerce technology company operating at very high transaction volume, with engineering challenges centered on scalable catalog, search, and logistics systems.',
    interviewProcess:
      'Large e-commerce platforms commonly test standard data-structures-and-algorithms rounds alongside questions probing how a candidate would design a system to handle high read/write volume, reflecting the scale the underlying platform actually operates at.',
    focusAreas: ['arrays-and-hashing', 'trees', 'graphs', 'dynamic-programming'],
    prepTips:
      'Practice both general algorithm problems and basic system-design fundamentals (caching, sharding, read/write scaling at a conceptual level), since high-scale e-commerce companies commonly ask about both even for non-senior roles.',
  },
  {
    companySlug: 'goldman-sachs',
    overview:
      'A large global financial services firm with a substantial internal technology organization, where engineering roles commonly involve trading, risk, and financial-infrastructure systems with strict correctness requirements.',
    interviewProcess:
      'Financial services firms with large internal engineering organizations commonly emphasize correctness, precise handling of numerical edge cases, and clear communication about trade-offs, alongside standard algorithmic coding rounds.',
    focusAreas: ['arrays-and-hashing', 'binary-search', 'dynamic-programming', 'complexity-analysis'],
    prepTips:
      'As with other finance-adjacent companies, practice being explicit about edge cases and precision (rounding, overflow, off-by-one errors) — correctness-under-scrutiny is a commonly reported theme in this industry\'s technical interviews.',
  },
];
