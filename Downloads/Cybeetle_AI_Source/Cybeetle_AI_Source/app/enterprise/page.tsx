import {
  Activity,
  Android,
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  Cloud,
  Globe2,
  Laptop,
  LockKeyhole,
  MonitorSmartphone,
  Network,
  Server,
  ShieldCheck,
  Smartphone,
  Users,
  Waypoints,
} from "lucide-react";
import "./enterprise.css";

const environments = [
  {
    name: "Android Workspace",
    status: "Available now",
    detail: "Existing Cybeetle Android environment for apps, testing, automation, and remote access.",
    icon: Android,
    live: true,
  },
  {
    name: "Linux Workspace",
    status: "Coming next",
    detail: "Ubuntu and hardened Linux workspaces for developers, cloud operations, and security teams.",
    icon: Server,
    live: false,
  },
  {
    name: "Windows Workspace",
    status: "Planned",
    detail: "Managed Windows desktops for enterprise applications and remote work, subject to licensing.",
    icon: Laptop,
    live: false,
  },
];

const deviceRows = [
  ["ENG-MBP-021", "Engineering", "macOS", "Compliant", "Online"],
  ["OPS-LNX-044", "Operations", "Ubuntu", "Compliant", "Online"],
  ["MOB-128", "Field Team", "Android", "Compliant", "Online"],
  ["FIN-PC-014", "Finance", "Windows", "Review", "Offline"],
];

export default function EnterprisePage() {
  return (
    <main className="enterprise-page">
      <nav className="enterprise-nav">
        <a href="/" className="brand">
          <img src="/beetle.png" alt="Cybeetle" />
          <span>CYBEETLE</span>
        </a>
        <div className="nav-links">
          <a href="#platform">Platform</a>
          <a href="#control">Control plane</a>
          <a href="#environments">Environments</a>
          <a href="#security">Security</a>
        </div>
        <a href="/web" className="nav-cta">Open Cybeetle</a>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow-pill"><ShieldCheck size={15}/> CYBEETLE ENTERPRISE</div>
          <h1>One secure control plane for every device, user, and cloud workspace.</h1>
          <p className="hero-text">
            Centralize organizational access, device posture, private networking, and virtual
            environments while keeping the existing Cybeetle Android workspace at the center.
          </p>
          <div className="hero-actions">
            <a href="#control" className="button primary">Explore the control plane <ArrowRight size={17}/></a>
            <a href="#environments" className="button secondary">View environments</a>
          </div>
          <div className="trust-row">
            <span><LockKeyhole size={15}/> Encrypted access</span>
            <span><Network size={15}/> Private networking</span>
            <span><MonitorSmartphone size={15}/> Any device</span>
          </div>
        </div>

        <div className="hero-console" aria-label="Cybeetle enterprise dashboard preview">
          <div className="console-top">
            <div>
              <span className="console-label">ORGANIZATION</span>
              <strong>Cybeetle Labs</strong>
            </div>
            <span className="secure-state"><span/> Secure</span>
          </div>
          <div className="stats-grid">
            <article><Users/><span>Members</span><strong>184</strong><small>+12 this month</small></article>
            <article><MonitorSmartphone/><span>Managed devices</span><strong>327</strong><small>96% compliant</small></article>
            <article><Boxes/><span>Cloud workspaces</span><strong>63</strong><small>41 running</small></article>
            <article><Waypoints/><span>Private network</span><strong>8</strong><small>regions online</small></article>
          </div>
          <div className="console-card">
            <div className="console-card-head">
              <div><span className="console-label">SECURITY POSTURE</span><strong>Organization health</strong></div>
              <span className="health">96%</span>
            </div>
            <div className="health-bar"><span/></div>
            <div className="posture-grid">
              <span><CheckCircle2/> MFA enforced</span>
              <span><CheckCircle2/> Disk encryption</span>
              <span><CheckCircle2/> Private access</span>
              <span><CheckCircle2/> Device identity</span>
            </div>
          </div>
        </div>
      </section>

      <section className="logo-strip">
        <span>SECURE ACCESS</span><i/>
        <span>DEVICE MANAGEMENT</span><i/>
        <span>PRIVATE CLOUD</span><i/>
        <span>AGENTIC OPERATIONS</span>
      </section>

      <section className="section" id="platform">
        <div className="section-heading">
          <span className="kicker">PLATFORM</span>
          <h2>Bring the organization into one operating layer.</h2>
          <p>Cybeetle connects identity, devices, networking, and cloud compute without forcing administrators to manage each system in isolation.</p>
        </div>
        <div className="feature-grid">
          <article><div className="feature-icon"><Users/></div><h3>Identity & access</h3><p>Organize users, teams, roles, device identities, and access policies from one tenant.</p></article>
          <article><div className="feature-icon"><MonitorSmartphone/></div><h3>Device management</h3><p>See inventory, operating systems, compliance state, connection status, and organizational ownership.</p></article>
          <article><div className="feature-icon"><Network/></div><h3>Private networking</h3><p>Connect approved people, devices, services, and cloud workspaces through secure private routes.</p></article>
          <article><div className="feature-icon"><Cloud/></div><h3>Cloud workspaces</h3><p>Provision isolated environments for mobile, development, browser, and enterprise workloads.</p></article>
        </div>
      </section>

      <section className="section control-section" id="control">
        <div className="control-copy">
          <span className="kicker">CONTROL PLANE</span>
          <h2>A command center for the whole organization.</h2>
          <p>
            Administrators can understand what is connected, what is compliant, and what each
            user can access before a session reaches a protected resource.
          </p>
          <ul>
            <li><CheckCircle2/> Organization and team-level RBAC</li>
            <li><CheckCircle2/> Device registration and cryptographic identity</li>
            <li><CheckCircle2/> Policy-based access and posture checks</li>
            <li><CheckCircle2/> Session visibility and audit events</li>
          </ul>
        </div>
        <div className="device-panel">
          <div className="panel-title">
            <div><span className="console-label">DEVICES</span><strong>Organization inventory</strong></div>
            <span className="live-dot"><i/> Live</span>
          </div>
          <div className="device-table">
            <div className="device-row head"><span>Device</span><span>Team</span><span>OS</span><span>Posture</span><span>Status</span></div>
            {deviceRows.map((row) => (
              <div className="device-row" key={row[0]}>
                <span className="device-name"><Laptop size={15}/>{row[0]}</span>
                <span>{row[1]}</span><span>{row[2]}</span>
                <span className={row[3] === "Compliant" ? "ok" : "review"}>{row[3]}</span>
                <span className={row[4] === "Online" ? "online" : "offline"}>{row[4]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="environments">
        <div className="section-heading split">
          <div>
            <span className="kicker">CLOUD ENVIRONMENTS</span>
            <h2>One account. Multiple secure computers.</h2>
          </div>
          <p>Android is already part of Cybeetle. Linux comes next, followed by Windows as the infrastructure and licensing layer matures.</p>
        </div>
        <div className="environment-grid">
          {environments.map(({name,status,detail,icon:Icon,live}) => (
            <article className={live ? "environment live" : "environment"} key={name}>
              <div className="environment-top">
                <div className="environment-icon"><Icon/></div>
                <span className={live ? "status live-status" : "status"}>{status}</span>
              </div>
              <h3>{name}</h3>
              <p>{detail}</p>
              <div className="environment-footer">
                <span>{live ? "Integrated with current Cybeetle project" : "Architecture reserved"}</span>
                <ArrowRight size={16}/>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section architecture" id="security">
        <div className="section-heading">
          <span className="kicker">SECURE ARCHITECTURE</span>
          <h2>Identity first. Network second. Compute third.</h2>
          <p>Cybeetle can evaluate the user and device before placing a session onto a private route or launching a cloud environment.</p>
        </div>
        <div className="architecture-flow">
          <div><Smartphone/><span>User + device</span><small>Passkey · posture · identity</small></div>
          <ArrowRight/>
          <div><ShieldCheck/><span>Policy engine</span><small>Allow · deny · approve</small></div>
          <ArrowRight/>
          <div><Globe2/><span>Private network</span><small>Encrypted organizational access</small></div>
          <ArrowRight/>
          <div><Server/><span>Cloud workspace</span><small>Android · Linux · Windows</small></div>
        </div>
      </section>

      <section className="final-cta">
        <div>
          <span className="kicker">CYBEETLE ENTERPRISE</span>
          <h2>Secure access. Real compute. One organizational control plane.</h2>
        </div>
        <a href="/web" className="button primary">Open Cybeetle Web <ArrowRight size={17}/></a>
      </section>

      <footer>
        <a href="/" className="brand"><img src="/beetle.png" alt="Cybeetle"/><span>CYBEETLE</span></a>
        <p>Private cloud workspaces and secure organizational access.</p>
      </footer>
    </main>
  );
}
