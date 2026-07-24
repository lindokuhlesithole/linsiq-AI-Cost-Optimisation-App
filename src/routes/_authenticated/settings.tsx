import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout, PageHeader } from "@/components/app-layout";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CloudCheck, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings · Linsiq" },
      { name: "description", content: "Connect your AWS account and configure notification preferences for Linsiq." },
      { property: "og:title", content: "Settings · Linsiq" },
      { property: "og:description", content: "Connect AWS and configure notifications." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [roleArn, setRoleArn] = useState("");
  const [externalId] = useState("linsiq-4820-af31-e920");
  const [connected, setConnected] = useState(false);

  const [notifWeekly, setNotifWeekly] = useState(true);
  const [notifBigSavings, setNotifBigSavings] = useState(true);
  const [notifApplied, setNotifApplied] = useState(false);
  const [notifSlack, setNotifSlack] = useState(false);

  const connect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleArn.startsWith("arn:aws:iam::")) {
      toast.error("Invalid Role ARN", { description: "Must start with arn:aws:iam::" });
      return;
    }
    setConnected(true);
    toast.success("AWS account connected", { description: "Cost data will sync within 15 minutes." });
  };

  const savePrefs = () => toast.success("Preferences saved");

  return (
    <AppLayout>
      <PageHeader
        title="Settings"
        description="Manage your AWS connection and how Linsiq reaches out."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 gap-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Connect AWS account</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create an IAM role with read-only Cost Explorer + service-scoped permissions, then paste the ARN below.
              </p>
            </div>
            {connected && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-savings-muted px-3 py-1 text-xs font-medium text-savings">
                <CloudCheck className="h-3.5 w-3.5" /> Connected
              </span>
            )}
          </div>

          <form onSubmit={connect} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="externalId">External ID</Label>
              <div className="flex gap-2">
                <Input id="externalId" value={externalId} readOnly className="font-mono text-sm" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(externalId);
                    toast.success("External ID copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use this as the <code className="rounded bg-muted px-1 py-0.5 text-[11px]">sts:ExternalId</code> condition on your trust policy.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleArn">Role ARN</Label>
              <Input
                id="roleArn"
                placeholder="arn:aws:iam::123456789012:role/LinsiqReadOnly"
                value={roleArn}
                onChange={(e) => setRoleArn(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit">{connected ? "Reconnect" : "Connect account"}</Button>
              <a
                href="#"
                className="text-sm font-medium text-primary hover:underline"
                onClick={(e) => e.preventDefault()}
              >
                View setup guide →
              </a>
            </div>
          </form>
        </Card>

        <Card className="p-6 gap-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Notifications</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose what Linsiq alerts you about.</p>
          </div>

          <div className="space-y-4">
            <NotifRow
              label="Weekly savings report"
              desc="Every Monday at 9:00 AM"
              checked={notifWeekly}
              onChange={setNotifWeekly}
            />
            <NotifRow
              label="High-impact opportunities"
              desc="Alert when savings > $1,000/mo"
              checked={notifBigSavings}
              onChange={setNotifBigSavings}
            />
            <NotifRow
              label="Applied action digest"
              desc="Summary of automated actions"
              checked={notifApplied}
              onChange={setNotifApplied}
            />
            <NotifRow
              label="Slack integration"
              desc="Post alerts to #finops"
              checked={notifSlack}
              onChange={setNotifSlack}
            />
          </div>

          <div className="pt-2">
            <Button onClick={savePrefs} className="w-full">
              Save preferences
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function NotifRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
