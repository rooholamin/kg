'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Item1 from './notifications/item-1';
import Item3 from './notifications/item-3';
import Item5 from './notifications/item-5';

const Divider = () => <div className="border-b border-b-border" />;

export function NotificationsSheet({ trigger }) {
  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="p-0 gap-0 sm:w-[500px] sm:max-w-none inset-5 start-auto h-auto rounded-lg p-0 sm:max-w-none [&_[data-slot=sheet-close]]:top-4.5 [&_[data-slot=sheet-close]]:end-5">
        <SheetHeader className="mb-0">
          <SheetTitle className="p-3">Notifications</SheetTitle>
        </SheetHeader>
        <SheetBody className="p-0">
          <ScrollArea className="h-[calc(100vh-10.5rem)]">
            <Tabs defaultValue="all" className="w-full relative">
              <TabsList variant="line" className="w-full px-5 mb-5">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="inbox" className="relative">
                  Inbox
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 absolute top-1 -end-1" />
                </TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="following">Following</TabsTrigger>
                <div className="grow flex items-center justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" mode="icon" className="mb-1">
                        <Settings className="size-4.5!" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-48" side="bottom" align="end">
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/settings">Notification Preferences</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/users">Manage Team</Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TabsList>

              {/* All Tab */}
              <TabsContent value="all" className="mt-0">
                <div className="flex flex-col gap-5">
                  <Item5
                    userName="Sarah Chen"
                    avatar="300-3.png"
                    badgeColor="online"
                    description="moved"
                    link="5 Best AI Tools in 2026"
                    day="to Review stage"
                    date="18 mins ago"
                    info="Technology"
                  />
                  <Divider />
                  <Item3
                    userName="Marcus Webb"
                    avatar="300-11.png"
                    badgeColor="online"
                    description="requested your approval for"
                    link="Retirement Planning Basics"
                    day=""
                    date="1 hour ago"
                    info="Finance"
                  />
                  <Divider />
                  <Item1
                    userName="Alex Rivera"
                    avatar="300-5.png"
                    description="mentioned you in"
                    link="AI Investment Guide"
                    label="brief"
                    time="2 hours ago"
                    specialist="Technology"
                    text="@You — can you review the keyword strategy section before this goes to assets?"
                  />
                  <Divider />
                  <Item5
                    userName="Jordan Lee"
                    avatar="300-1.png"
                    badgeColor="online"
                    description="completed writing"
                    link="Budgeting for Beginners"
                    day=""
                    date="4 hours ago"
                    info="Finance"
                  />
                  <Divider />
                  <Item5
                    userName="AI System"
                    avatar="300-34.png"
                    badgeColor="offline"
                    description="completed generation for"
                    link="Climate Tech Investment Guide"
                    day="— ready for review"
                    date="6 hours ago"
                    info="Automation"
                  />
                </div>
              </TabsContent>

              {/* Inbox Tab */}
              <TabsContent value="inbox" className="mt-0">
                <div className="flex flex-col gap-5">
                  <Item3
                    userName="Marcus Webb"
                    avatar="300-11.png"
                    badgeColor="online"
                    description="needs your approval on"
                    link="Blockchain Basics Explained"
                    day=""
                    date="30 mins ago"
                    info="Finance"
                  />
                  <Divider />
                  <Item5
                    userName="Sarah Chen"
                    avatar="300-3.png"
                    badgeColor="online"
                    description="assigned you"
                    link="Passive Income Strategies"
                    day="article"
                    date="2 hours ago"
                    info="Finance"
                  />
                  <Divider />
                  <Item5
                    userName="AI System"
                    avatar="300-34.png"
                    badgeColor="offline"
                    description="generation failed for"
                    link="Crypto Trading Basics"
                    day="— retry needed"
                    date="5 hours ago"
                    info="Automation"
                  />
                  <Divider />
                  <Item1
                    userName="Jordan Lee"
                    avatar="300-1.png"
                    description="mentioned you in"
                    link="Pension Planning Guide"
                    label="deadline note"
                    time="1 day ago"
                    specialist="Finance"
                    text="@You — this one has a hard publish date next Monday, can you prioritise the review?"
                  />
                </div>
              </TabsContent>

              {/* Team Tab */}
              <TabsContent value="team" className="mt-0">
                <div className="flex flex-col gap-5">
                  <Item5
                    userName="Sarah Chen"
                    avatar="300-3.png"
                    badgeColor="online"
                    description="moved"
                    link="Tax Planning Guide 2026"
                    day="to Assets stage"
                    date="45 mins ago"
                    info="Finance"
                  />
                  <Divider />
                  <Item5
                    userName="Marcus Webb"
                    avatar="300-11.png"
                    badgeColor="online"
                    description="submitted"
                    link="Investment Strategy Basics"
                    day="for approval"
                    date="2 hours ago"
                    info="Finance"
                  />
                  <Divider />
                  <Item1
                    userName="Alex Rivera"
                    avatar="300-5.png"
                    description="commented on"
                    link="SEO Fundamentals for Writers"
                    label="article"
                    time="1 day ago"
                    specialist="Technology"
                    text="@You — added 3 internal linking suggestions and updated the meta description draft."
                  />
                  <Divider />
                  <Item5
                    userName="Priya Nair"
                    avatar="300-2.png"
                    badgeColor="online"
                    description="started writing"
                    link="Lifestyle Finance Basics"
                    day=""
                    date="2 days ago"
                    info="Finance"
                  />
                </div>
              </TabsContent>

              {/* Following Tab */}
              <TabsContent value="following" className="mt-0">
                <div className="flex flex-col gap-5">
                  <Item5
                    userName="Content System"
                    avatar="300-34.png"
                    badgeColor="offline"
                    description='"Personal Finance" topic'
                    link="reached 10 published articles"
                    day="— milestone hit"
                    date="1 hour ago"
                    info="Finance"
                  />
                  <Divider />
                  <Item5
                    userName="AI System"
                    avatar="300-34.png"
                    badgeColor="offline"
                    description="AI Command Center ran"
                    link="15 generations today"
                    day="— all successful"
                    date="3 hours ago"
                    info="Automation"
                  />
                  <Divider />
                  <Item5
                    userName="Sarah Chen"
                    avatar="300-3.png"
                    badgeColor="online"
                    description='"Retirement Planning" series is'
                    link="90% complete"
                    day="— 1 article remaining"
                    date="1 day ago"
                    info="Finance"
                  />
                  <Divider />
                  <Item5
                    userName="Alex Rivera"
                    avatar="300-5.png"
                    badgeColor="online"
                    description='"Technology" category approval rate'
                    link="reached 94%"
                    day="this month"
                    date="2 days ago"
                    info="Technology"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </ScrollArea>
        </SheetBody>
        <SheetFooter className="border-t border-border p-5 grid grid-cols-2 gap-2.5">
          <Button variant="outline">Archive all</Button>
          <Button variant="outline">Mark all as read</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
