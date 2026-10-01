CREATE TABLE `music_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`track_id` integer NOT NULL,
	`reason` text NOT NULL,
	`detail` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`created_at` integer NOT NULL
);
