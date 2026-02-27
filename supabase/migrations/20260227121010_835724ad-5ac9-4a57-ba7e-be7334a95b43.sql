-- Enable realtime for request_items and uploads tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.uploads;