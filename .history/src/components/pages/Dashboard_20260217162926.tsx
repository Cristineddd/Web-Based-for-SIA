      {/* Quick Actions & Recent Exams */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card className="card-elevated border-2 border-[#2F4A35]/20 hover:border-[#4F7A6B] transition-colors duration-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full justify-start gap-3 h-12 border-2 border-[#2F4A35]/20 hover:border-[#4F7A6B] hover:bg-[#4F7A6B]/10 transition-colors duration-200" 
              variant="outline"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4" />
              Create New Exam
            </Button>
            
            <div className="h-2"></div>
            
            <Link href="/students">
              <Button className="w-full justify-start gap-3 h-12 border-2 border-[#2F4A35]/20 hover:border-[#4F7A6B] hover:bg-[#4F7A6B]/10 transition-colors duration-200" variant="outline">
                <Users className="w-4 h-4" />
                Manage Students
              </Button>
            </Link>
            
            <div className="h-2"></div>
            
            <Link href="/exams">
              <Button className="w-full justify-start gap-3 h-12 border-2 border-[#2F4A35]/20 hover:border-[#4F7A6B] hover:bg-[#4F7A6B]/10 transition-colors duration-200" variant="outline">
                <FileText className="w-4 h-4" />
                View All Exams
              </Button>
            </Link>
          </CardContent>
        </Card>