'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  Calendar,
  CheckSquare,
  FileText,
  LayoutDashboard,
  Link2,
  Search,
  Settings,
  Tag,
  Users,
} from 'lucide-react';
import { toAbsoluteUrl } from '@/lib/helpers';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AccordionMenu,
  AccordionMenuGroup,
  AccordionMenuItem,
} from '@/components/ui/accordion-menu';
import { Badge, BadgeDot } from '@/components/ui/badge';
import { EllipsisVertical } from 'lucide-react';

const quickActions = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: FileText, label: 'All Articles', href: '/dashboard/articles' },
  { icon: Bot, label: 'AI Command Center', href: '/dashboard/ai' },
  { icon: Calendar, label: 'Editorial Calendar', href: '/dashboard/calendar' },
  { icon: CheckSquare, label: 'Approvals', href: '/dashboard/approvals' },
  { icon: Link2, label: 'SEO & Linking', href: '/dashboard/seo' },
  { icon: Tag, label: 'Categories', href: '/dashboard/categories' },
  { icon: Users, label: 'Users & Roles', href: '/dashboard/users' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

const recentArticles = [
  { title: '5 Best AI Tools in 2026', meta: 'Writing · Technology · Updated 1 hour ago', href: '/dashboard/articles/art-1' },
  { title: 'Retirement Planning Basics', meta: 'Review · Finance · Updated 3 hours ago', href: '/dashboard/articles/art-2' },
  { title: 'Budgeting for Beginners', meta: 'Planning · Finance · Updated yesterday', href: '/dashboard/articles/art-3' },
  { title: 'Climate Tech Investment Guide', meta: 'Research · Technology · Updated 2 days ago', href: '/dashboard/articles/art-4' },
  { title: 'Passive Income Strategies', meta: 'Approval · Finance · Updated 3 days ago', href: '/dashboard/articles/art-5' },
  { title: 'SEO Fundamentals for Writers', meta: 'Published · Technology · Updated 4 days ago', href: '/dashboard/articles/art-6' },
];

const teamMembers = [
  { avatar: '300-3.png', name: 'Sarah Chen', role: 'Editor', label: 'Active', color: 'success' },
  { avatar: '300-11.png', name: 'Marcus Webb', role: 'Writer', label: 'Active', color: 'success' },
  { avatar: '300-5.png', name: 'Alex Rivera', role: 'SEO Lead', label: 'Active', color: 'success' },
  { avatar: '300-1.png', name: 'Jordan Lee', role: 'Writer', label: 'On Leave', color: 'destructive' },
  { avatar: '300-2.png', name: 'Priya Nair', role: 'Content Strategist', label: 'Active', color: 'success' },
];

export function SearchDialog({ trigger }) {
  const [searchInput, setSearchInput] = useState('');

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="lg:max-w-[600px] lg:top-[15%] lg:translate-y-0 p-0 [&_[data-slot=dialog-close]]:top-5.5 [&_[data-slot=dialog-close]]:end-5.5">
        <DialogHeader className="px-4 py-1 mb-1">
          <DialogTitle></DialogTitle>
          <DialogDescription></DialogDescription>
          <div className="relative">
            <Search className="absolute top-1/2 -translate-y-1/2 size-4" />
            <Input
              type="text"
              name="query"
              value={searchInput}
              className="ps-6 outline-none! ring-0! shadow-none! border-0"
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search articles, topics, categories..."
            />
          </div>
        </DialogHeader>
        <DialogBody className="p-0 pb-5">
          <Tabs defaultValue="all">
            <TabsList className="justify-start px-5 mb-2.5" variant="line">
              <div className="flex items-center gap-5">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="articles">Articles</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
              </div>
            </TabsList>
            <ScrollArea className="h-[480px]">
              {/* All tab: quick actions + recent articles */}
              <TabsContent value="all">
                <div className="flex flex-col gap-2.5">
                  <div className="pt-2.5 pb-1.5">
                    <span className="ps-5 text-xs text-secondary-foreground font-medium">Quick Actions</span>
                    <div className="pt-2">
                      <AccordionMenu type="single" collapsible classNames={{ separator: '-mx-2 mb-2.5' }}>
                        <AccordionMenuGroup>
                          {quickActions.map((action) => (
                            <AccordionMenuItem key={action.href} value={action.label} asChild>
                              <Link href={action.href} className="flex items-center gap-2">
                                <action.icon size={16} />
                                <span>{action.label}</span>
                              </Link>
                            </AccordionMenuItem>
                          ))}
                        </AccordionMenuGroup>
                      </AccordionMenu>
                    </div>
                  </div>
                  <div className="border-b border-b-border" />
                  <div className="pt-2.5 pb-1.5">
                    <span className="ps-5 text-xs text-secondary-foreground font-medium">Recent Articles</span>
                    <ArticleList items={recentArticles} />
                  </div>
                </div>
              </TabsContent>

              {/* Articles tab */}
              <TabsContent value="articles">
                <div className="pt-2.5">
                  <ArticleList items={recentArticles} />
                </div>
              </TabsContent>

              {/* Team tab */}
              <TabsContent value="team">
                <div className="grid gap-2 m-2 mt-3">
                  {teamMembers.map((member) => (
                    <div key={member.name} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 cursor-pointer">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={toAbsoluteUrl(`/media/avatars/${member.avatar}`)}
                          className="rounded-full size-9 shrink-0"
                          alt={member.name}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-mono hover:text-primary mb-px">{member.name}</span>
                          <span className="text-xs text-muted-foreground">{member.role}</span>
                        </div>
                      </div>
                      <Badge size="md" variant={member.color} appearance="light" shape="circle">
                        <BadgeDot /> {member.label}
                      </Badge>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function ArticleList({ items }) {
  return (
    <div className="grid gap-1 px-3 pt-1">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/60 group"
        >
          <div className="flex items-center justify-center size-8 rounded-md bg-primary/10 shrink-0">
            <FileText className="size-4 text-primary" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-mono group-hover:text-primary truncate">{item.title}</span>
            <span className="text-xs text-muted-foreground truncate">{item.meta}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
