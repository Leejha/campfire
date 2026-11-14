interface NotionSessionQueryKeyParams {
  date: string;
}

export const getQueryKeys = {
  notionDashboard: (): readonly ['notion', 'dashboard'] => ['notion', 'dashboard'],
  notionSession: ({ date }: Readonly<NotionSessionQueryKeyParams>): readonly ['notion', 'session', string] => [
    'notion',
    'session',
    date,
  ],
};
