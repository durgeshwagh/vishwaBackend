const PERMISSIONS = [
    {
        screen: "Dashboard",
        key: "screen.dashboard",
        actions: [
            { id: "dashboard.view", label: "View Dashboard" },
            { id: "stats.view", label: "View Statistics" }
        ]
    },
    {
        screen: "Members Directory",
        key: "screen.members",
        actions: [
            { id: "member.view", label: "View Members List" },
            { id: "member.create", label: "Add New Member" },
            { id: "member.edit", label: "Edit Member" },
            { id: "member.delete", label: "Delete Member" },
            { id: "primary.view", label: "View Primary Members List" }
        ]
    },
    {
        screen: "Committee (All Members)",
        key: "screen.committee",
        actions: [
            { id: "committee.view", label: "View Committee Tab" }
        ]
    },
    {
        screen: "Family Trees",
        key: "screen.family",
        actions: [
            { id: "family.view", label: "View Family Trees" },
            { id: "family.edit", label: "Edit Family Structures" }
        ]
    },
    {
        screen: "Matrimonial Portal",
        key: "screen.matrimony",
        actions: [
            { id: "matrimony.view", label: "View Matrimony Portal" },
            { id: "matrimony.create", label: "Add Matrimony Profiles" }
        ]
    },
    {
        screen: "Funds & Donations",
        key: "screen.funds",
        actions: [
            { id: "funds.manage", label: "Manage Funds & Expenses (Full Access)" },
            { id: "funds.create", label: "Add Funds/Donations" },
            { id: "donations.view", label: "View Donations" },
            { id: "notices.view", label: "View Notices" },
            { id: "notices.manage", label: "Manage Notices/News" }
        ]
    },
    {
        screen: "User Permissions (Admin)",
        key: "screen.admin",
        actions: [
            { id: "admin.access", label: "Access Admin Panel" },
            { id: "users.manage", label: "Manage Users (Invite/Approve)" }
        ]
    }
];

module.exports = PERMISSIONS;
