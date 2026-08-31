import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendDailySummaryEmail(
    to: string,
    name: string,
    personalTotal: number,
    workspaceSummaries: { workspaceName: string; total: number }[]
) {
    const workspaceLines = workspaceSummaries
        .map((w) => `- ${w.workspaceName}: ${w.total.toFixed(2)}`)
        .join("\n");

    const text = `Hi ${name},

Here's your expense summary for today:

Personal: ${personalTotal.toFixed(2)}
${workspaceLines || "No shared expenses today."}

- Hisab Kitab`;

    await sgMail.send({
        to,
        from: process.env.SENDGRID_FROM_EMAIL!,
        subject: "Your daily expense summary",
        text,
    });
}