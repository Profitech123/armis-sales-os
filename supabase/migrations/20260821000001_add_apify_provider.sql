-- Add apify to the integration_provider enum used by integration_connections
-- and webhook_events tables.
alter type public.integration_provider add value if not exists 'apify';
