CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(180) NOT NULL,
	"message" text NOT NULL,
	"badge" varchar(32) DEFAULT 'General' NOT NULL,
	"target" varchar(12) DEFAULT 'all' NOT NULL,
	"target_user_id" uuid,
	"target_email" varchar(180),
	"created_by" varchar(180),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"whatsapp" varchar(24) NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_name" varchar(120) NOT NULL,
	"order_code" varchar(24) NOT NULL,
	"product_title" varchar(300) NOT NULL,
	"amount" integer NOT NULL,
	"proof_image" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"delivered_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_proofs_order_code_unique" UNIQUE("order_code")
);
--> statement-breakpoint
CREATE TABLE "notification_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_code" varchar(24) NOT NULL,
	"user_id" uuid,
	"category_slug" varchar(48),
	"customer_name" varchar(100) NOT NULL,
	"customer_whatsapp" varchar(24) NOT NULL,
	"player_uid" varchar(64),
	"player_name" varchar(120),
	"product_name" varchar(180) NOT NULL,
	"original_amount" integer DEFAULT 0 NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"coupon_code" varchar(50),
	"amount" integer NOT NULL,
	"status" varchar(24) DEFAULT 'awaiting_contact' NOT NULL,
	"account_login_type" varchar(48),
	"account_email" varchar(180),
	"account_password" text,
	"otp_code" varchar(24),
	"verification_paid" boolean DEFAULT false NOT NULL,
	"verification_screenshot" text,
	"verification_paid_at" timestamp with time zone,
	"payment_screenshot" text,
	"buyer_ip" varchar(64),
	"buyer_city" varchar(120),
	"buyer_region" varchar(120),
	"buyer_country" varchar(120),
	"paid_at" timestamp with time zone,
	"commissionable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_code_unique" UNIQUE("order_code")
);
--> statement-breakpoint
CREATE TABLE "point_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reward_id" uuid,
	"reward_title" varchar(180) NOT NULL,
	"uc_amount" integer NOT NULL,
	"points_cost" integer NOT NULL,
	"player_uid" varchar(64) NOT NULL,
	"player_name" varchar(120),
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"admin_note" varchar(255),
	"processed_by" varchar(180),
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referred_user_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_code" varchar(24) NOT NULL,
	"purchase_amount" integer NOT NULL,
	"commission_percent" integer NOT NULL,
	"points" integer NOT NULL,
	"status" varchar(16) DEFAULT 'credited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversed_at" timestamp with time zone,
	CONSTRAINT "referral_commissions_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "reward_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(180) NOT NULL,
	"uc_amount" integer NOT NULL,
	"points_cost" integer NOT NULL,
	"badge" varchar(48),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"sender" varchar(12) NOT NULL,
	"sender_name" varchar(120),
	"message" text NOT NULL,
	"attachment" text,
	"attachment_name" varchar(255),
	"attachment_type" varchar(64),
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"order_code" varchar(24) NOT NULL,
	"user_id" uuid NOT NULL,
	"customer_name" varchar(120),
	"customer_email" varchar(180),
	"product_name" varchar(180) NOT NULL,
	"status" varchar(16) DEFAULT 'open' NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "support_tickets_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "user_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"type" varchar(24) NOT NULL,
	"badge" varchar(32),
	"title" varchar(180) NOT NULL,
	"body" text,
	"link" varchar(300),
	"order_id" uuid,
	"ticket_id" uuid,
	"announcement_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
